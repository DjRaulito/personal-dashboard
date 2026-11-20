import { describe, expect, it } from "vitest";
import {
  checkOutfit,
  colorsAgree,
  colorText,
  deltaE,
  detailsFromFamilies,
  dominantColor,
  toneOf,
  type ColorDetail,
  type RuleGarment,
} from "./colors";

const detail = (family: ColorDetail["family"], tone: ColorDetail["tone"], name: string = family): ColorDetail => ({
  name,
  family,
  tone,
  hex: "#777777",
});
const g = (name: string, category: string, color: ColorDetail, pattern: RuleGarment["pattern"] = "plain") => ({
  name,
  category,
  colors: [color],
  pattern,
});

describe("armario · color de la foto", () => {
  it("encuentra el color dominante entre los píxeles visibles", () => {
    const data = new Uint8ClampedArray(400 * 4);
    for (let i = 0; i < 400; i++) {
      const navy = i < 300;
      data.set(navy ? [30, 40, 70, 255] : [240, 240, 240, 255], i * 4);
    }
    // Fondo transparente rojo: no cuenta
    const withBg = new Uint8ClampedArray([...data, ...new Array(800).fill(0).map((_, i) => (i % 4 === 0 ? 255 : 0))]);
    expect(dominantColor(withBg, { step: 1 })).toBe("#1e2846");
    expect(dominantColor(new Uint8ClampedArray(40))).toBeNull();
  });

  it("compara el color de la IA con el medido", () => {
    expect(deltaE("#000000", "#ffffff")).toBeCloseTo(100, 0);
    expect(colorsAgree("#1f2a44", "#1e2846")).toBe(true);
    expect(colorsAgree("#1f2a44", "#7f9a6c")).toBe(false);
  });

  it("sabe si un color es claro, medio u oscuro", () => {
    expect(toneOf("#1c1c20")).toBe("dark");
    expect(toneOf("#f0efe9")).toBe("light");
    expect(toneOf("#8d8d96")).toBe("medium");
  });

  it("convierte las familias antiguas en colores con nombre y tono", () => {
    expect(detailsFromFamilies(["navy"])).toEqual([
      { name: "azul marino", family: "navy", tone: "dark", hex: "#2f3b5c" },
    ]);
  });

  it("dice el tono solo si el nombre no lo dice ya", () => {
    expect(colorText(detail("navy", "dark", "azul marino oscuro"))).toBe("azul marino oscuro");
    expect(colorText(detail("green", "medium", "verde oliva"))).toBe("verde oliva, tono medio");
  });
});

describe("armario · reglas de combinación", () => {
  it("acepta neutros con un color protagonista", () => {
    const r = checkOutfit([
      g("Camisa verde", "top", detail("green", "medium")),
      g("Chino beige", "bottom", detail("beige", "light")),
      g("Gorra roja", "accessory", detail("red", "medium")),
    ]);
    expect(r).toEqual({ ok: true, problems: [], notes: [] });
  });

  it("descarta dos colores protagonistas o dos prendas con dibujo", () => {
    expect(
      checkOutfit([
        g("Camisa verde", "top", detail("green", "medium")),
        g("Pantalón rojo", "bottom", detail("red", "medium")),
      ]).ok,
    ).toBe(false);
    const r = checkOutfit([
      g("Camisa de cuadros", "top", detail("white", "light"), "checks"),
      g("Pantalón de rayas", "bottom", detail("navy", "dark"), "stripes"),
    ]);
    expect(r.ok).toBe(false);
    expect(r.problems[0]).toContain("dos prendas con dibujo");
  });

  it("avisa de poco contraste sin descartar", () => {
    const r = checkOutfit([
      g("Jersey negro", "top", detail("black", "dark")),
      g("Vaquero marino", "bottom", detail("navy", "dark")),
    ]);
    expect(r.ok).toBe(true);
    expect(r.notes[0]).toContain("poco contraste");
  });
});
