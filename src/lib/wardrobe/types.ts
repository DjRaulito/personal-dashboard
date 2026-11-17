// Armario: vocabulario común (categorías, colores, ocasiones) para cliente y servidor.

export const CATEGORIES = ["top", "bottom", "outerwear", "shoes", "accessory"] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  top: "Parte de arriba",
  bottom: "Pantalón",
  outerwear: "Abrigo",
  shoes: "Calzado",
  accessory: "Accesorio",
};

export const CATEGORY_PLURALS: Record<Category, string> = {
  top: "Partes de arriba",
  bottom: "Pantalones",
  outerwear: "Abrigos y chaquetas",
  shoes: "Calzado",
  accessory: "Accesorios",
};

export const OCCASIONS = ["daily", "work", "sport", "night", "formal"] as const;
export type Occasion = (typeof OCCASIONS)[number];

export const OCCASION_LABELS: Record<Occasion, string> = {
  daily: "Diario",
  work: "Trabajo",
  sport: "Deporte",
  night: "Salir",
  formal: "Formal",
};

export const COLORS = [
  "black",
  "white",
  "grey",
  "beige",
  "brown",
  "navy",
  "blue",
  "green",
  "red",
  "pink",
  "yellow",
  "orange",
  "purple",
] as const;
export type GarmentColor = (typeof COLORS)[number];

/** Nombre y muestra de cada color (tonos apagados, ver DESIGN.md). */
export const COLOR_INFO: Record<GarmentColor, { label: string; hex: string }> = {
  black: { label: "Negro", hex: "#1c1c20" },
  white: { label: "Blanco", hex: "#f0efe9" },
  grey: { label: "Gris", hex: "#8d8d96" },
  beige: { label: "Beige", hex: "#d2c2a2" },
  brown: { label: "Marrón", hex: "#7d5a44" },
  navy: { label: "Azul marino", hex: "#2f3b5c" },
  blue: { label: "Azul", hex: "#6f8fc4" },
  green: { label: "Verde", hex: "#7f9a6c" },
  red: { label: "Rojo", hex: "#b4574d" },
  pink: { label: "Rosa", hex: "#d3a0ad" },
  yellow: { label: "Amarillo", hex: "#d9c36f" },
  orange: { label: "Naranja", hex: "#d19059" },
  purple: { label: "Morado", hex: "#8d78a8" },
};

export const WARMTH_LABELS: Record<number, string> = { 1: "Ligera", 2: "Entretiempo", 3: "Abrigada" };

export interface Garment {
  id: string;
  name: string;
  category: Category;
  colors: GarmentColor[];
  warmth: number;
  occasions: Occasion[];
  cutout: boolean;
  /** Enlace firmado y temporal a la foto (null si no se pudo firmar). */
  url: string | null;
}

export interface Outfit {
  id: string;
  name: string;
  occasion: Occasion | null;
  note: string | null;
  garmentIds: string[];
}

/** Lo que lleva puesto el maniquí: una prenda por zona y los accesorios. */
export interface Look {
  top: string | null;
  bottom: string | null;
  outerwear: string | null;
  shoes: string | null;
  accessories: string[];
}

export const EMPTY_LOOK: Look = { top: null, bottom: null, outerwear: null, shoes: null, accessories: [] };

export const MAX_ACCESSORIES = 2;

/** Reparte unas prendas por zonas (la primera de cada zona gana). */
export function lookFrom(ids: string[], garments: Garment[]): Look {
  const byId = new Map(garments.map((g) => [g.id, g]));
  const look: Look = { ...EMPTY_LOOK, accessories: [] };
  for (const id of ids) {
    const g = byId.get(id);
    if (!g) continue;
    if (g.category === "accessory") {
      if (look.accessories.length < MAX_ACCESSORIES && !look.accessories.includes(id)) look.accessories.push(id);
    } else if (look[g.category] === null) {
      look[g.category] = id;
    }
  }
  return look;
}

export const lookIds = (look: Look): string[] =>
  [look.outerwear, look.top, look.bottom, look.shoes, ...look.accessories].filter((id): id is string => !!id);

/** Zona del cuerpo para «Probar en mí»: solo se pueden probar estas categorías. */
export const TRYON_PARTS = {
  top: "upper_body",
  outerwear: "upper_body",
  bottom: "lower_body",
} as const satisfies Partial<Record<Category, "upper_body" | "lower_body">>;
