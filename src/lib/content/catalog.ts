import { z } from "zod";

// Contenido: estados del tablero, plataformas, formatos y validación de formularios.

export const STATUSES = ["idea", "script", "recording", "editing", "scheduled", "published"] as const;
export type PieceStatus = (typeof STATUSES)[number];

export const STATUS_LABEL: Record<PieceStatus, string> = {
  idea: "Idea",
  script: "Guion",
  recording: "Grabación",
  editing: "Edición",
  scheduled: "Programado",
  published: "Publicado",
};

export const PLATFORMS = ["youtube", "instagram", "tiktok", "other"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const PLATFORM_LABEL: Record<Platform, string> = {
  youtube: "YouTube",
  instagram: "Instagram",
  tiktok: "TikTok",
  other: "Otra",
};

export const FORMATS = ["short", "long", "post", "story"] as const;
export type PieceFormat = (typeof FORMATS)[number];

export const FORMAT_LABEL: Record<PieceFormat, string> = {
  short: "Vídeo corto",
  long: "Vídeo largo",
  post: "Publicación",
  story: "Historia",
};

export const PRIORITY_LABEL: Record<number, string> = { 1: "Alta", 2: "Media", 3: "Baja" };

/** Separa una lista escrita a mano («a, b; c» o una por línea), sin repetidos ni vacíos. */
export function splitList(raw: string, max: number, maxLength: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[,;\n]/)) {
    const value = part.trim().slice(0, maxLength);
    const key = value.toLowerCase();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length === max) break;
  }
  return out;
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres`)
    .transform((v) => v || null);

/** Fecha y hora local del formulario (datetime-local) o vacío. */
const localDateTime = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v), "Fecha no válida")
  .transform((v) => v || null);

export const pieceFormSchema = z.object({
  id: z.uuid().optional(),
  title: z.string().trim().min(1, "Ponle un título").max(200, "Máximo 200 caracteres"),
  status: z.enum(STATUSES).default("idea"),
  format: z.enum(FORMATS).default("short"),
  platforms: z.array(z.enum(PLATFORMS)).max(4).default([]),
  priority: z.coerce.number().int().min(1).max(3).default(2),
  tags: z
    .string()
    .prefault("")
    .transform((v) => splitList(v, 8, 30)),
  script: optionalText(20000).prefault(""),
  notes: optionalText(5000).prefault(""),
  links: z
    .string()
    .prefault("")
    .transform((v) => splitList(v.replace(/\s+/g, "\n"), 10, 500))
    .refine((links) => links.every((l) => /^https?:\/\//i.test(l)), "Los enlaces deben empezar por http(s)://"),
  publish_at: localDateTime.prefault(""),
  published_url: optionalText(500)
    .prefault("")
    .refine((v) => v === null || /^https?:\/\//i.test(v), "Debe empezar por http(s)://"),
});

export type PieceForm = z.infer<typeof pieceFormSchema>;

export const quickIdeaSchema = z.object({
  title: z.string().trim().min(1, "Escribe la idea").max(200, "Máximo 200 caracteres"),
  format: z.enum(FORMATS).default("short"),
  priority: z.coerce.number().int().min(1).max(3).default(2),
});

const count = z.coerce.number().int().min(0, "No puede ser negativo").max(2_000_000_000);

export const metricFormSchema = z.object({
  piece_id: z.uuid(),
  platform: z.enum(PLATFORMS),
  recorded_on: z.iso.date("Fecha no válida"),
  views: count.default(0),
  likes: count.default(0),
  comments: count.default(0),
  shares: count.default(0),
  saves: count.default(0),
  followers_gained: z.coerce.number().int().min(-1_000_000).max(100_000_000).default(0),
});

/**
 * Posición para una ficha que cae entre dos vecinas del tablero. Sin vecinas usa 1000;
 * al principio o al final se separa 1000 de la vecina.
 */
export function positionBetween(before: number | null, after: number | null): number {
  if (before === null && after === null) return 1000;
  if (before === null) return after! - 1000;
  if (after === null) return before + 1000;
  return (before + after) / 2;
}

export interface MetricRow {
  piece_id: string;
  platform: Platform;
  recorded_on: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  followers_gained: number;
}

export interface MetricTotals {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  followers_gained: number;
}

const EMPTY_TOTALS: MetricTotals = { views: 0, likes: 0, comments: 0, shares: 0, saves: 0, followers_gained: 0 };

/**
 * Las métricas se apuntan como foto acumulada: para cada pieza y plataforma vale la última
 * fecha. Devuelve el total por pieza (suma de plataformas).
 */
export function latestTotalsByPiece(rows: MetricRow[]): Map<string, MetricTotals> {
  const latest = new Map<string, MetricRow>();
  for (const row of rows) {
    const key = `${row.piece_id}:${row.platform}`;
    const current = latest.get(key);
    if (!current || row.recorded_on > current.recorded_on) latest.set(key, row);
  }
  const totals = new Map<string, MetricTotals>();
  for (const row of latest.values()) {
    const t = totals.get(row.piece_id) ?? { ...EMPTY_TOTALS };
    t.views += row.views;
    t.likes += row.likes;
    t.comments += row.comments;
    t.shares += row.shares;
    t.saves += row.saves;
    t.followers_gained += row.followers_gained;
    totals.set(row.piece_id, t);
  }
  return totals;
}

/** Tasa de interacción: (me gusta + comentarios + compartidos + guardados) / visualizaciones. */
export function engagementRate(t: MetricTotals): number | null {
  if (!t.views) return null;
  return (t.likes + t.comments + t.shares + t.saves) / t.views;
}

export function sumTotals(list: Iterable<MetricTotals>): MetricTotals {
  const out = { ...EMPTY_TOTALS };
  for (const t of list) {
    out.views += t.views;
    out.likes += t.likes;
    out.comments += t.comments;
    out.shares += t.shares;
    out.saves += t.saves;
    out.followers_gained += t.followers_gained;
  }
  return out;
}
