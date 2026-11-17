// Armario con IA: etiquetar una prenda a partir de su foto y proponer outfits.
// La IA solo elige entre las prendas que existen (por número); la app valida que el conjunto
// tenga sentido (una parte de arriba, un pantalón…) antes de enseñarlo.
import { z } from "zod";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  COLOR_INFO,
  COLORS,
  MAX_ACCESSORIES,
  OCCASION_LABELS,
  OCCASIONS,
  WARMTH_LABELS,
  type Garment,
  type Occasion,
} from "./types";

export const SYSTEM_WARDROBE =
  "Eres un estilista personal de moda masculina y femenina. Respondes en español de España, " +
  "con criterio práctico y sin inventar prendas que no estén en la lista.";

// ---------------------------------------------------------------------------
// Etiquetar una prenda desde su foto
// ---------------------------------------------------------------------------

const subset = <T extends string>(allowed: readonly T[], max: number) =>
  z
    .array(z.string())
    .catch([])
    .transform((list) =>
      [...new Set(list.filter((v): v is T => (allowed as readonly string[]).includes(v)))].slice(0, max),
    );

export const garmentTagSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .transform((s) => s.slice(0, 80)),
  category: z.enum(CATEGORIES),
  colors: subset(COLORS, 4),
  warmth: z.coerce.number().int().min(1).max(3).catch(2),
  occasions: subset(OCCASIONS, OCCASIONS.length),
});
export type GarmentTags = z.infer<typeof garmentTagSchema>;

export const TAG_PROMPT = `Mira la foto de una prenda de ropa y descríbela con este JSON:
{"name": "nombre corto en español, p. ej. «Camiseta blanca lisa»",
 "category": "${CATEGORIES.join(" | ")}",
 "colors": ["de uno a tres colores, el principal primero, entre: ${COLORS.join(", ")}"],
 "warmth": "1 (ligera, para calor), 2 (entretiempo) o 3 (abrigada, para frío)",
 "occasions": ["las que encajen entre: ${OCCASIONS.join(", ")}"]}
Categorías: top = camisetas, camisas, polos, jerséis y sudaderas; bottom = pantalones, vaqueros, bermudas y faldas;
outerwear = abrigos, chaquetas, cazadoras y chalecos; shoes = cualquier calzado; accessory = gorras, bufandas, cinturones, relojes, bolsos…
Ocasiones: daily = diario, work = trabajo, sport = deporte, night = salir, formal = formal.`;

// ---------------------------------------------------------------------------
// El tiempo
// ---------------------------------------------------------------------------

export interface Weather {
  /** Mínima y máxima de hoy, en °C. */
  min: number;
  max: number;
  /** Probabilidad de lluvia de hoy, 0–100. */
  rain: number;
}

/** "9–17 °C · lluvia probable (70 %)". */
export function weatherLine(w: Weather): string {
  const temps = `${Math.round(w.min)}–${Math.round(w.max)} °C`;
  if (w.rain >= 60) return `${temps} · lluvia probable (${Math.round(w.rain)} %)`;
  if (w.rain >= 30) return `${temps} · puede llover (${Math.round(w.rain)} %)`;
  return `${temps} · sin lluvia`;
}

/** Nivel de abrigo que pide el día (1 calor, 2 entretiempo, 3 frío), por la temperatura media. */
export function warmthFor(w: Weather): 1 | 2 | 3 {
  const mean = (w.min + w.max) / 2;
  return mean < 12 ? 3 : mean < 21 ? 2 : 1;
}

// ---------------------------------------------------------------------------
// Proponer outfits
// ---------------------------------------------------------------------------

export const outfitSuggestionSchema = z.object({
  outfits: z
    .array(
      z.object({
        name: z
          .string()
          .trim()
          .min(1)
          .transform((s) => s.slice(0, 80)),
        why: z
          .string()
          .trim()
          .catch("")
          .transform((s) => s.slice(0, 300)),
        items: z.array(z.coerce.number().int().min(0)).min(1).max(12),
      }),
    )
    .min(1)
    .max(6),
});
export type OutfitSuggestion = z.infer<typeof outfitSuggestionSchema>;

export interface OutfitRequest {
  occasion: Occasion | null;
  weather: Weather | null;
  /** Prenda que tiene que estar en todos los conjuntos. */
  pinId: string | null;
  wishes: string;
}

const garmentLine = (g: Garment, n: number) =>
  [
    n,
    g.name,
    g.category,
    g.colors.map((c) => COLOR_INFO[c].label.toLowerCase()).join("/") || "color sin indicar",
    `abrigo ${g.warmth} (${WARMTH_LABELS[g.warmth].toLowerCase()})`,
    g.occasions.map((o) => OCCASION_LABELS[o].toLowerCase()).join(", ") || "sin ocasión indicada",
  ].join(" · ");

export function outfitPrompt(garments: Garment[], request: OutfitRequest): string {
  const pin = request.pinId ? garments.findIndex((g) => g.id === request.pinId) : -1;
  const lines = [
    "Estas son las prendas del armario (número · nombre · categoría · colores · abrigo · ocasiones):",
    ...garments.map(garmentLine),
    "",
    "Propón 3 conjuntos distintos entre sí usando solo esas prendas.",
    "Cada conjunto lleva exactamente una prenda «top» y una «bottom», un «shoes» si hay alguno, " +
      `como mucho un «outerwear» y como mucho ${MAX_ACCESSORIES} «accessory».`,
    "Los colores tienen que combinar: neutros (negro, blanco, gris, beige, azul marino) con casi todo, " +
      "como mucho un color llamativo por conjunto, y evita juntar dos estampados o dos colores que choquen.",
  ];
  if (request.occasion)
    lines.push(`Ocasión: ${OCCASION_LABELS[request.occasion].toLowerCase()}. Prioriza las prendas pensadas para ella.`);
  if (request.weather) {
    const need = warmthFor(request.weather);
    lines.push(
      `Tiempo de hoy: ${weatherLine(request.weather)}. Conviene ropa de abrigo ${need} (${WARMTH_LABELS[need].toLowerCase()}).` +
        (need === 1 ? " No pongas «outerwear»." : need === 3 ? " Pon un «outerwear» si hay." : "") +
        (request.weather.rain >= 60 ? " Con lluvia, evita calzado delicado si hay alternativa." : ""),
    );
  }
  if (pin >= 0) lines.push(`La prenda ${pin} tiene que estar en los tres conjuntos.`);
  if (request.wishes.trim()) lines.push(`Petición: ${request.wishes.trim().slice(0, 200)}`);
  lines.push(
    "",
    'Responde con este JSON: {"outfits": [{"name": "nombre corto del conjunto", ' +
      '"why": "una frase: por qué combina y por qué encaja hoy", "items": [números de las prendas]}]}',
  );
  return lines.join("\n");
}

export interface ResolvedOutfit {
  name: string;
  why: string;
  garmentIds: string[];
}

/**
 * Convierte la respuesta de la IA en conjuntos válidos: prendas que existen, una por zona,
 * la prenda fijada dentro, y sin conjuntos repetidos. Los que no tengan parte de arriba y
 * pantalón (cuando el armario los tiene) se descartan.
 */
export function resolveOutfits(
  suggestion: OutfitSuggestion,
  garments: Garment[],
  pinId: string | null,
): ResolvedOutfit[] {
  const pin = pinId ? (garments.find((g) => g.id === pinId) ?? null) : null;
  const has = (category: Garment["category"]) => garments.some((g) => g.category === category);
  const seen = new Set<string>();
  const out: ResolvedOutfit[] = [];

  for (const outfit of suggestion.outfits) {
    const picked = [...new Set(outfit.items)].map((n) => garments[n]).filter((g): g is Garment => !!g);
    const single = new Map<string, Garment>();
    const accessories: Garment[] = [];
    // La prenda fijada va primero para quedarse con su zona
    for (const g of pin ? [pin, ...picked] : picked) {
      if (g.category === "accessory") {
        if (accessories.length < MAX_ACCESSORIES && !accessories.includes(g)) accessories.push(g);
      } else if (!single.has(g.category)) {
        single.set(g.category, g);
      }
    }
    if ((has("top") && !single.has("top")) || (has("bottom") && !single.has("bottom"))) continue;
    const ordered = [
      ...(["outerwear", "top", "bottom", "shoes"] as const).map((c) => single.get(c)),
      ...accessories,
    ].filter((g): g is Garment => !!g);
    if (ordered.length < 2) continue;
    const key = ordered
      .map((g) => g.id)
      .sort()
      .join(",");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name: outfit.name, why: outfit.why, garmentIds: ordered.map((g) => g.id) });
    if (out.length === 3) break;
  }
  return out;
}

/** Texto alternativo de una prenda. */
export const garmentAlt = (g: Garment) => `${g.name} (${CATEGORY_LABELS[g.category].toLowerCase()})`;
