import { describe, expect, it } from "vitest";
import { garmentTagSchema, outfitPrompt, resolveOutfits, warmthFor, weatherLine } from "./ai";
import { lookFrom, lookIds, type Garment } from "./types";

const garment = (id: string, category: Garment["category"], extra: Partial<Garment> = {}): Garment => ({
  id,
  name: id,
  category,
  colors: [],
  warmth: 2,
  occasions: [],
  cutout: true,
  url: null,
  ...extra,
});

const wardrobe = [
  garment("camiseta", "top", { colors: ["white"], warmth: 1 }),
  garment("jersey", "top", { colors: ["navy"], warmth: 3 }),
  garment("vaquero", "bottom", { colors: ["blue"] }),
  garment("chino", "bottom", { colors: ["beige"] }),
  garment("zapatillas", "shoes"),
  garment("abrigo", "outerwear", { warmth: 3 }),
  garment("gorra", "accessory"),
  garment("bufanda", "accessory"),
  garment("reloj", "accessory"),
];

describe("armario · etiquetas de la IA", () => {
  it("se queda solo con colores y ocasiones conocidos", () => {
    const tags = garmentTagSchema.parse({
      name: "  Sudadera gris  ",
      category: "top",
      colors: ["grey", "turquesa", "grey", "black"],
      warmth: "3",
      occasions: ["daily", "boda"],
    });
    expect(tags).toEqual({
      name: "Sudadera gris",
      category: "top",
      colors: ["grey", "black"],
      warmth: 3,
      occasions: ["daily"],
    });
  });

  it("no acepta una categoría inventada y rellena el abrigo si viene mal", () => {
    expect(garmentTagSchema.safeParse({ name: "x", category: "vestido", colors: [], occasions: [] }).success).toBe(
      false,
    );
    expect(garmentTagSchema.parse({ name: "x", category: "shoes", warmth: 9 }).warmth).toBe(2);
  });
});

describe("armario · tiempo", () => {
  it("resume el día y el abrigo que pide", () => {
    expect(weatherLine({ min: 8.6, max: 17.2, rain: 70 })).toBe("9–17 °C · lluvia probable (70 %)");
    expect(weatherLine({ min: 20, max: 31, rain: 5 })).toBe("20–31 °C · sin lluvia");
    expect(warmthFor({ min: 2, max: 10, rain: 0 })).toBe(3);
    expect(warmthFor({ min: 12, max: 20, rain: 0 })).toBe(2);
    expect(warmthFor({ min: 20, max: 32, rain: 0 })).toBe(1);
  });
});

describe("armario · outfits", () => {
  it("el encargo lleva las prendas numeradas, la ocasión, el tiempo y la prenda fijada", () => {
    const prompt = outfitPrompt(wardrobe, {
      occasion: "work",
      weather: { min: 3, max: 9, rain: 80 },
      pinId: "chino",
      wishes: "algo sobrio",
    });
    expect(prompt).toContain("1 · jersey · top · azul marino · abrigo 3 (abrigada)");
    expect(prompt).toContain("Ocasión: trabajo");
    expect(prompt).toContain("abrigo 3");
    expect(prompt).toContain("La prenda 3 tiene que estar");
    expect(prompt).toContain("Petición: algo sobrio");
  });

  it("valida los conjuntos: una prenda por zona, la fijada dentro y sin repetidos", () => {
    const resolved = resolveOutfits(
      {
        outfits: [
          // dos partes de arriba y tres accesorios: se queda la primera y dos accesorios
          { name: "A", why: "", items: [0, 1, 2, 4, 6, 7, 8] },
          // sin pantalón: fuera
          { name: "B", why: "", items: [0, 4] },
          // el mismo conjunto que A en otro orden: fuera
          { name: "C", why: "", items: [8, 7, 6, 4, 2, 0].slice(1) },
          // prenda que no existe: se ignora
          { name: "D", why: "frío", items: [1, 3, 5, 99] },
        ],
      },
      wardrobe,
      null,
    );
    expect(resolved.map((o) => o.name)).toEqual(["A", "D"]);
    expect(resolved[0].garmentIds).toEqual(["camiseta", "vaquero", "zapatillas", "gorra", "bufanda"]);
    expect(resolved[1]).toEqual({ name: "D", why: "frío", garmentIds: ["abrigo", "jersey", "chino"] });
  });

  it("la prenda fijada sustituye a la de su zona", () => {
    const [outfit] = resolveOutfits({ outfits: [{ name: "A", why: "", items: [0, 2, 4] }] }, wardrobe, "chino");
    expect(outfit.garmentIds).toEqual(["camiseta", "chino", "zapatillas"]);
  });

  it("reparte las prendas por zonas del maniquí", () => {
    const look = lookFrom(["abrigo", "jersey", "camiseta", "chino", "gorra", "bufanda", "reloj", "nada"], wardrobe);
    expect(look).toEqual({
      top: "jersey",
      bottom: "chino",
      outerwear: "abrigo",
      shoes: null,
      accessories: ["gorra", "bufanda"],
    });
    expect(lookIds(look)).toEqual(["abrigo", "jersey", "chino", "gorra", "bufanda"]);
  });
});
