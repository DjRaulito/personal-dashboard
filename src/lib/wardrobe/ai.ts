// Armario con IA (v3): la IA ve, nombra y combina los colores; la app lo comprueba con reglas
// fijas antes de enseñarlo. La IA solo elige entre las prendas que existen (por número).
import { z } from "zod";
import { checkOutfit, colorText, PATTERN_LABELS, PATTERNS, TONES, type ColorDetail } from "./colors";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  COLORS,
  MAX_ACCESSORIES,
  OCCASION_LABELS,
  OCCASIONS,
  WARMTH_LABELS,
  type Garment,
} from "./types";

export const SYSTEM_WARDROBE =
  "Eres un estilista personal que ayuda a una persona daltónica. Respondes en español de España, " +
  "nombras los colores con precisión y con palabras (nunca solo «rojo» o «verde» si hay un nombre más exacto), " +
  "siempre dices si el tono es claro, medio u oscuro, y no inventas prendas que no estén en la lista.";

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

export const colorDetailSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .transform((s) => s.slice(0, 40).toLowerCase()),
  family: z.enum(COLORS),
  tone: z.enum(TONES).catch("medium"),
  hex: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .transform((s) => s.toLowerCase())
    .catch("#808080"),
});

export const garmentTagSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .transform((s) => s.slice(0, 80)),
  category: z.enum(CATEGORIES),
  colors: z
    .array(z.unknown())
    .catch([])
    .transform((list) =>
      list
        .map((c) => colorDetailSchema.safeParse(c))
        .flatMap((r) => (r.success ? [r.data] : []))
        .slice(0, 4),
    ),
  pattern: z.enum(PATTERNS).catch("plain"),
  fabric: z
    .string()
    .trim()
    .max(40)
    .nullable()
    .catch(null)
    .transform((s) => s || null),
  formality: z.coerce.number().int().min(1).max(5).catch(2),
  warmth: z.coerce.number().int().min(1).max(3).catch(2),
  occasions: subset(OCCASIONS, OCCASIONS.length),
});
export type GarmentTags = z.infer<typeof garmentTagSchema>;

export const TAG_PROMPT = `Mira la foto de una prenda de ropa y descríbela con este JSON:
{"name": "nombre corto en español con su color, p. ej. «Camisa azul cielo de rayas»",
 "category": "${CATEGORIES.join(" | ")}",
 "colors": [{"name": "nombre preciso del color en español, p. ej. «azul marino oscuro», «verde oliva», «gris jaspeado», «burdeos»",
             "family": "la familia más cercana entre: ${COLORS.join(", ")}",
             "tone": "light | medium | dark",
             "hex": "#rrggbb aproximado"}],
 "pattern": "${PATTERNS.join(" | ")}",
 "fabric": "tejido si se nota (algodón, lana, vaquero, punto, lino, piel…) o null",
 "formality": "1 (deporte) a 5 (traje)",
 "warmth": "1 (ligera, para calor), 2 (entretiempo) o 3 (abrigada, para frío)",
 "occasions": ["las que encajen entre: ${OCCASIONS.join(", ")}"]}
Pon de uno a tres colores, el principal primero. Ignora el fondo.
Categorías: top = camisetas, camisas, polos, jerséis y sudaderas; bottom = pantalones, vaqueros, bermudas y faldas;
outerwear = abrigos, chaquetas, cazadoras y chalecos; shoes = cualquier calzado; accessory = gorras, bufandas, cinturones, relojes, bolsos…
Patrones: plain = liso, stripes = rayas, checks = cuadros, print = estampado, other = otro dibujo.
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
// ¿Qué me pongo?
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
  /** El plan del día en una frase («cena con amigos») o el evento del calendario. */
  plan: string;
  weather: Weather | null;
  /** Prenda que tiene que estar en todos los conjuntos. */
  pinId: string | null;
  /** Prendas puestas en los últimos días: mejor no repetirlas. */
  recentIds: string[];
}

const colorsLine = (colors: ColorDetail[]) => colors.map(colorText).join(" / ") || "color sin indicar";

export const garmentLine = (g: Garment, n: number) =>
  [
    n,
    g.name,
    g.category,
    colorsLine(g.colorDetails),
    PATTERN_LABELS[g.pattern],
    `formalidad ${g.formality}/5`,
    `abrigo ${g.warmth} (${WARMTH_LABELS[g.warmth].toLowerCase()})`,
    g.occasions.map((o) => OCCASION_LABELS[o].toLowerCase()).join(", ") || "sin ocasión indicada",
  ].join(" · ");

export function outfitPrompt(garments: Garment[], request: OutfitRequest): string {
  const pin = request.pinId ? garments.findIndex((g) => g.id === request.pinId) : -1;
  const recent = garments.flatMap((g, i) => (request.recentIds.includes(g.id) ? [i] : []));
  const lines = [
    "Estas son las prendas del armario (número · nombre · categoría · colores · dibujo · formalidad · abrigo · ocasiones):",
    ...garments.map(garmentLine),
    "",
    "Propón 3 conjuntos distintos entre sí usando solo esas prendas.",
    "Cada conjunto lleva exactamente una prenda «top» y una «bottom», un «shoes» si hay alguno, " +
      `como mucho un «outerwear» y como mucho ${MAX_ACCESSORIES} «accessory».`,
    "Reglas de color: neutros (negro, blanco, gris, beige, marrón, azul marino) con casi todo; como mucho UN color " +
      "protagonista por conjunto; nunca dos prendas con dibujo; busca contraste claro/oscuro entre arriba y abajo.",
  ];
  if (request.plan.trim())
    lines.push(`Plan de hoy: ${request.plan.trim().slice(0, 200)}. Ajusta la formalidad al plan.`);
  if (request.weather) {
    const need = warmthFor(request.weather);
    lines.push(
      `Tiempo de hoy: ${weatherLine(request.weather)}. Conviene ropa de abrigo ${need} (${WARMTH_LABELS[need].toLowerCase()}).` +
        (need === 1 ? " No pongas «outerwear»." : need === 3 ? " Pon un «outerwear» si hay." : "") +
        (request.weather.rain >= 60 ? " Con lluvia, evita calzado delicado si hay alternativa." : ""),
    );
  }
  if (recent.length) lines.push(`Prendas puestas estos días (evítalas si hay alternativa): ${recent.join(", ")}.`);
  if (pin >= 0) lines.push(`La prenda ${pin} tiene que estar en los tres conjuntos.`);
  lines.push(
    "",
    'Responde con este JSON: {"outfits": [{"name": "nombre corto del conjunto", ' +
      '"why": "UNA frase: nombra los colores con palabras y di por qué combinan y por qué encaja hoy", ' +
      '"items": [números de las prendas]}]}',
  );
  return lines.join("\n");
}

export interface ResolvedOutfit {
  name: string;
  why: string;
  garmentIds: string[];
  /** Avisos de las reglas que no descartan el conjunto (poco contraste). */
  notes: string[];
}

/**
 * Convierte la respuesta de la IA en conjuntos válidos: prendas que existen, una por zona,
 * la prenda fijada dentro, sin repetidos y que pasen las reglas de color.
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
    const check = checkOutfit(ordered.map((g) => ({ ...g, colors: g.colorDetails })));
    if (!check.ok) continue;
    const key = ordered
      .map((g) => g.id)
      .sort()
      .join(",");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name: outfit.name, why: outfit.why, garmentIds: ordered.map((g) => g.id), notes: check.notes });
    if (out.length === 3) break;
  }
  return out;
}

// ---------------------------------------------------------------------------
// ¿Combina?
// ---------------------------------------------------------------------------

export const VERDICTS = ["yes", "risky", "no"] as const;
export type Verdict = (typeof VERDICTS)[number];
export const VERDICT_LABELS: Record<Verdict, string> = {
  yes: "Combina",
  risky: "Arriesgado",
  no: "No combina",
};

export const combineSchema = z.object({
  /** Lo que se ve en la foto (o las prendas elegidas), con su color en palabras. */
  pieces: z
    .array(
      z.object({
        what: z
          .string()
          .trim()
          .min(1)
          .transform((s) => s.slice(0, 60)),
        color: z
          .string()
          .trim()
          .min(1)
          .transform((s) => s.slice(0, 60)),
        tone: z.enum(TONES).catch("medium"),
      }),
    )
    .max(8)
    .catch([]),
  verdict: z.enum(VERDICTS).catch("risky"),
  summary: z
    .string()
    .trim()
    .min(1)
    .transform((s) => s.slice(0, 300)),
  /** Un arreglo concreto si no combina («cambia la camisa verde por la blanca»), o null. */
  fix: z
    .string()
    .trim()
    .max(300)
    .nullable()
    .catch(null)
    .transform((s) => s || null),
});
export type CombineResult = z.infer<typeof combineSchema>;

const COMBINE_RESPONSE =
  'Responde con este JSON: {"pieces": [{"what": "prenda", "color": "color preciso en palabras", "tone": "light | medium | dark"}], ' +
  '"verdict": "yes | risky | no", "summary": "una o dos frases: por qué sí o por qué no, nombrando los colores", ' +
  '"fix": "si no combina o es arriesgado, un cambio concreto usando prendas del armario («cambia X por Y»); si combina, null"}';

/** ¿Combinan estas prendas del armario? Se le pasa también el resultado de las reglas fijas. */
export function combineGarmentsPrompt(selected: Garment[], wardrobe: Garment[]): string {
  const check = checkOutfit(selected.map((g) => ({ ...g, colors: g.colorDetails })));
  const others = wardrobe.filter((g) => !selected.includes(g));
  return [
    "¿Combinan estas prendas puestas juntas?",
    ...selected.map((g, i) => garmentLine(g, i)),
    "",
    check.problems.length || check.notes.length
      ? `Las reglas fijas dicen: ${[...check.problems, ...check.notes].join(" ")}`
      : "Las reglas fijas no ven problemas.",
    "",
    "Otras prendas del armario para proponer un cambio:",
    ...others
      .slice(0, 60)
      .map((g) => `- ${g.name} (${CATEGORY_LABELS[g.category].toLowerCase()}, ${colorsLine(g.colorDetails)})`),
    "",
    COMBINE_RESPONSE,
  ].join("\n");
}

/** ¿Combina lo que llevo puesto? (foto). */
export function combinePhotoPrompt(wardrobe: Garment[]): string {
  return [
    "En la foto hay una persona (o unas prendas) y quiere saber si lo que lleva combina.",
    "Nombra cada prenda visible y su color con precisión y con palabras, y di si es claro, medio u oscuro.",
    "Reglas: neutros con casi todo, como mucho un color protagonista, nunca dos prendas con dibujo, " +
      "y mejor con contraste claro/oscuro entre arriba y abajo.",
    wardrobe.length
      ? `Prendas de su armario para proponer un cambio: ${wardrobe
          .slice(0, 60)
          .map((g) => `${g.name} (${colorsLine(g.colorDetails)})`)
          .join("; ")}.`
      : "",
    "",
    COMBINE_RESPONSE,
  ].join("\n");
}

/** Texto alternativo de una prenda. */
export const garmentAlt = (g: Garment) =>
  `${g.name} (${CATEGORY_LABELS[g.category].toLowerCase()}, ${colorsLine(g.colorDetails)})`;
