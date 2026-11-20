// Armario v3: los colores se dicen con palabras. La IA los nombra («azul marino oscuro») y la app
// los comprueba con la foto (color dominante) y con reglas fijas antes de enseñar un conjunto.
import { COLOR_INFO, COLORS, type GarmentColor } from "./types";

export const TONES = ["light", "medium", "dark"] as const;
export type Tone = (typeof TONES)[number];
export const TONE_LABELS: Record<Tone, string> = { light: "claro", medium: "medio", dark: "oscuro" };

export const PATTERNS = ["plain", "stripes", "checks", "print", "other"] as const;
export type Pattern = (typeof PATTERNS)[number];
export const PATTERN_LABELS: Record<Pattern, string> = {
  plain: "liso",
  stripes: "de rayas",
  checks: "de cuadros",
  print: "estampado",
  other: "con dibujo",
};

export interface ColorDetail {
  /** Nombre preciso en español: «azul marino oscuro», «gris jaspeado». */
  name: string;
  /** Familia, para filtrar y para las reglas. */
  family: GarmentColor;
  tone: Tone;
  hex: string;
}

/** Combinan con casi todo. */
export const NEUTRALS: readonly GarmentColor[] = ["black", "white", "grey", "beige", "brown", "navy"];
export const isNeutral = (c: GarmentColor) => NEUTRALS.includes(c);

// ---------------------------------------------------------------------------
// Color medido en la foto
// ---------------------------------------------------------------------------

const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
export const rgbToHex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((v) => clamp(v).toString(16).padStart(2, "0")).join("")}`;

export function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** sRGB → CIELAB (D65). */
export function rgbToLab([r, g, b]: [number, number, number]): [number, number, number] {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

/** Diferencia de color (CIE76). Por encima de ~30 son colores claramente distintos. */
export function deltaE(a: string, b: string): number | null {
  const ra = hexToRgb(a);
  const rb = hexToRgb(b);
  if (!ra || !rb) return null;
  const [l1, a1, b1] = rgbToLab(ra);
  const [l2, a2, b2] = rgbToLab(rb);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

/** Tono por la luminosidad: lo que más ayuda a combinar sin distinguir colores. */
export function toneOf(hex: string): Tone {
  const rgb = hexToRgb(hex);
  if (!rgb) return "medium";
  const [l] = rgbToLab(rgb);
  return l < 38 ? "dark" : l > 72 ? "light" : "medium";
}

/**
 * Color dominante de una foto RGBA sin fondo: k-medias sencillo sobre los píxeles visibles.
 * Devuelve null si casi no hay prenda.
 */
export function dominantColor(data: Uint8ClampedArray, { k = 4, iterations = 8, step = 4 } = {}): string | null {
  const pixels: [number, number, number][] = [];
  for (let i = 0; i < data.length; i += 4 * step) {
    if (data[i + 3] < 200) continue;
    pixels.push([data[i], data[i + 1], data[i + 2]]);
  }
  if (pixels.length < 20) return null;
  // Semillas repartidas por luminosidad para que sea determinista
  const sorted = [...pixels].sort((p, q) => p[0] + p[1] + p[2] - (q[0] + q[1] + q[2]));
  let centers = Array.from({ length: k }, (_, i) => sorted[Math.floor(((i + 0.5) / k) * sorted.length)]);
  let counts = new Array(k).fill(0);
  for (let it = 0; it < iterations; it++) {
    const sums = centers.map(() => [0, 0, 0]);
    counts = new Array(k).fill(0);
    for (const p of pixels) {
      let best = 0;
      let bestD = Infinity;
      centers.forEach((c, j) => {
        const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2;
        if (d < bestD) {
          bestD = d;
          best = j;
        }
      });
      counts[best] += 1;
      sums[best][0] += p[0];
      sums[best][1] += p[1];
      sums[best][2] += p[2];
    }
    centers = centers.map((c, j) =>
      counts[j] ? [sums[j][0] / counts[j], sums[j][1] / counts[j], sums[j][2] / counts[j]] : c,
    );
  }
  const top = counts.indexOf(Math.max(...counts));
  const [r, g, b] = centers[top];
  return rgbToHex(r, g, b);
}

/** ¿El color principal que dice la IA se parece al medido en la foto? Si no, «revisar con luz natural». */
export const colorsAgree = (aiHex: string, measuredHex: string, threshold = 32) => {
  const d = deltaE(aiHex, measuredHex);
  return d == null || d <= threshold;
};

/** Detalle mínimo a partir de las familias antiguas (prendas guardadas antes del Armario v3). */
export function detailsFromFamilies(families: GarmentColor[]): ColorDetail[] {
  return families
    .filter((f) => COLORS.includes(f))
    .map((family) => ({
      name: COLOR_INFO[family].label.toLowerCase(),
      family,
      tone: toneOf(COLOR_INFO[family].hex),
      hex: COLOR_INFO[family].hex,
    }));
}

/** «azul marino oscuro» → «Azul marino oscuro (oscuro)» solo si el nombre no dice ya el tono. */
export function colorText(c: ColorDetail): string {
  const name = c.name.trim();
  const tone = TONE_LABELS[c.tone];
  const said = /\b(claro|oscuro|medio|pastel|intenso)\b/i.test(name);
  return said ? name : `${name}, tono ${tone}`;
}

// ---------------------------------------------------------------------------
// Reglas fijas de combinación
// ---------------------------------------------------------------------------

export interface RuleGarment {
  name: string;
  category: string;
  colors: ColorDetail[];
  pattern: Pattern;
}

export interface OutfitCheck {
  /** Pasa las reglas duras: como mucho un color protagonista y un estampado. */
  ok: boolean;
  /** Frases cortas en español; las de `ok: false` explican por qué se descarta. */
  problems: string[];
  /** Avisos que no descartan (poco contraste). */
  notes: string[];
}

export function checkOutfit(garments: RuleGarment[]): OutfitCheck {
  const problems: string[] = [];
  const notes: string[] = [];
  const clothes = garments.filter((g) => g.category !== "accessory");
  const loud = new Map<GarmentColor, string>();
  for (const g of clothes) {
    const main = g.colors[0];
    if (main && !isNeutral(main.family)) loud.set(main.family, g.name);
  }
  if (loud.size > 1) {
    problems.push(`Hay más de un color protagonista (${[...loud.values()].join(" y ")}).`);
  }
  const patterned = clothes.filter((g) => g.pattern !== "plain");
  if (patterned.length > 1) {
    problems.push(`Junta dos prendas con dibujo (${patterned.map((g) => g.name).join(" y ")}).`);
  }
  const top = clothes.find((g) => g.category === "top")?.colors[0];
  const bottom = clothes.find((g) => g.category === "bottom")?.colors[0];
  if (top && bottom && top.tone === bottom.tone && top.tone !== "medium" && top.family !== bottom.family) {
    notes.push(`Arriba y abajo son los dos de tono ${TONE_LABELS[top.tone]}: hay poco contraste.`);
  }
  return { ok: problems.length === 0, problems, notes };
}
