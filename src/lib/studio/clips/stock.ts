import "server-only";
import { z } from "zod";
import type { Clip, VideoFormat } from "../catalog";

// Clips de vídeo de stock gratuitos y sin atribución obligatoria: Pixabay (principal) y Pexels
// (si hay clave; Pexels ya no da claves nuevas). Sin ninguna, el montaje usa imágenes IA o fondos
// animados generados. La búsqueda devuelve candidatos (con miniatura y etiquetas) y `pick.ts` elige
// con IA los que encajan con lo que dice la voz.

export const stockConfigured = () => Boolean(process.env.PIXABAY_API_KEY || process.env.PEXELS_API_KEY);

/** Fuentes con clave, para mostrarlas en la app. */
export const stockSources = () =>
  [process.env.PIXABAY_API_KEY && "Pixabay", process.env.PEXELS_API_KEY && "Pexels"].filter(Boolean) as string[];

interface Candidate {
  url: string;
  width: number;
  height: number;
}

/** Un clip encontrado, con lo necesario para elegirlo (no se guarda en el guion). */
export interface StockCandidate extends Clip {
  id: string;
  /** Miniatura JPG del clip (para que la IA lo vea). */
  thumb?: string;
  /** Etiquetas o descripción del banco de vídeo. */
  tags: string;
}

const OUTPUT: Record<VideoFormat, { width: number; height: number }> = {
  short: { width: 1080, height: 1920 },
  long: { width: 1920, height: 1080 },
};

/** Cuánto hay que ampliar un archivo para cubrir la pantalla del formato (1 = justo; >1 se ve blando). */
export function upscale(c: Candidate, format: VideoFormat): number {
  const out = OUTPUT[format];
  return Math.max(out.width / c.width, out.height / c.height);
}

/** Por encima de esto (p. ej. un clip horizontal 1080p recortado a vertical) se ve borroso: mejor otro plano. */
export const MAX_UPSCALE = 1.4;

/** El archivo más ligero que cubra la pantalla del formato sin ampliar; si ninguno llega, el más nítido. */
export function pickBest<T extends Candidate>(files: T[], format: VideoFormat): T | null {
  const ok = files.filter((f) => f.url && f.width > 0 && f.height > 0);
  if (!ok.length) return null;
  const pixels = (f: T) => f.width * f.height;
  const sharp = ok.filter((f) => upscale(f, format) <= 1.02).sort((a, b) => pixels(a) - pixels(b));
  return sharp[0] ?? [...ok].sort((a, b) => upscale(a, format) - upscale(b, format))[0];
}

/** Vertical para shorts, horizontal para vídeos largos. */
const fits = (c: Candidate, format: VideoFormat) => (format === "short" ? c.height > c.width : c.width >= c.height);

/** Las búsquedas alternativas que escribe la IA («man lifting barbell | gym workout | gym»). */
export function queryAlternatives(query: string): string[] {
  return [
    ...new Set(
      query
        .split("|")
        .map((q) => q.trim())
        .filter((q) => q.length >= 2),
    ),
  ].slice(0, 4);
}

const words = (text: string) =>
  text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3);

/**
 * Qué parte de la búsqueda aparece en las etiquetas del clip (0-1). Compara por raíz («lifting» ≈
 * «lift», «sleeping» ≈ «sleep») para no depender de cómo etiquetó el autor.
 */
export function tagScore(query: string, tags: string): number {
  const wanted = words(query);
  if (!wanted.length) return 0;
  const have = words(tags);
  const stem = (w: string) => w.slice(0, Math.max(4, w.length - 3));
  const hit = wanted.filter((w) => have.some((t) => t.startsWith(stem(w)) || w.startsWith(stem(t))));
  return hit.length / wanted.length;
}

// ---------------------------------------------------------------------------
// Pixabay
// ---------------------------------------------------------------------------

const pixabayFile = z.object({
  url: z.string(),
  width: z.number(),
  height: z.number(),
  thumbnail: z.string(),
});
const pixabayHit = z.object({
  id: z.number(),
  pageURL: z.string(),
  duration: z.number(),
  tags: z.string().default(""),
  isAiGenerated: z.boolean().optional(),
  isLowQuality: z.boolean().optional(),
  videos: z.record(z.string(), pixabayFile.partial().nullable()),
});
export type PixabayHit = z.infer<typeof pixabayHit>;

export function pixabayClip(hit: PixabayHit, format: VideoFormat): Clip | null {
  const files = Object.values(hit.videos)
    .filter((f): f is NonNullable<typeof f> => Boolean(f?.url))
    .map((f) => ({ url: f.url!, width: f.width ?? 0, height: f.height ?? 0 }));
  const file = pickBest(files, format);
  if (!file) return null;
  return { ...file, duration: hit.duration, page: hit.pageURL, source: "Pixabay" };
}

/** Candidato de Pixabay; descarta los vídeos hechos con IA (suelen ser 3D o dibujos) y los de baja calidad. */
export function pixabayCandidate(hit: PixabayHit, format: VideoFormat): StockCandidate | null {
  if (hit.isAiGenerated || hit.isLowQuality) return null;
  const clip = pixabayClip(hit, format);
  if (!clip) return null;
  const v = hit.videos;
  const thumb = v.small?.thumbnail || v.tiny?.thumbnail || v.medium?.thumbnail || undefined;
  return { ...clip, id: `pixabay:${hit.id}`, thumb, tags: hit.tags };
}

async function searchPixabay(query: string, format: VideoFormat): Promise<StockCandidate[]> {
  const key = process.env.PIXABAY_API_KEY;
  if (!key) return [];
  const params = new URLSearchParams({
    key,
    q: query.slice(0, 100),
    video_type: "film",
    safesearch: "true",
    per_page: "30",
  });
  const res = await fetch(`https://pixabay.com/api/videos/?${params}`, {
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Pixabay ${res.status}`);
  const data = z.object({ hits: z.array(z.unknown()).default([]) }).parse(await res.json());
  return data.hits.flatMap((raw) => {
    const hit = pixabayHit.safeParse(raw);
    const candidate = hit.success ? pixabayCandidate(hit.data, format) : null;
    return candidate ? [candidate] : [];
  });
}

// ---------------------------------------------------------------------------
// Pexels
// ---------------------------------------------------------------------------

const pexelsVideo = z.object({
  id: z.number(),
  url: z.string(),
  duration: z.number(),
  image: z.string().optional(),
  video_files: z.array(
    z.object({
      link: z.string(),
      width: z.number().nullable(),
      height: z.number().nullable(),
      file_type: z.string().nullable().optional(),
    }),
  ),
});
export type PexelsVideo = z.infer<typeof pexelsVideo>;

export function pexelsClip(video: PexelsVideo, format: VideoFormat): Clip | null {
  const files = video.video_files
    .filter((f) => (f.file_type ?? "video/mp4") === "video/mp4")
    .map((f) => ({ url: f.link, width: f.width ?? 0, height: f.height ?? 0 }));
  const file = pickBest(files, format);
  if (!file) return null;
  return { ...file, duration: video.duration, page: video.url, source: "Pexels" };
}

async function searchPexels(query: string, format: VideoFormat): Promise<StockCandidate[]> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return [];
  const params = new URLSearchParams({
    query,
    orientation: format === "short" ? "portrait" : "landscape",
    per_page: "12",
    size: "large",
  });
  const res = await fetch(`https://api.pexels.com/videos/search?${params}`, {
    headers: { Authorization: key },
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Pexels ${res.status}`);
  const data = z.object({ videos: z.array(z.unknown()).default([]) }).parse(await res.json());
  return data.videos.flatMap((raw) => {
    const video = pexelsVideo.safeParse(raw);
    if (!video.success) return [];
    const clip = pexelsClip(video.data, format);
    // La URL de la página de Pexels lleva la descripción («…/video/man-lifting-weights-123/»)
    const tags = video.data.url.split("/").filter(Boolean).pop()?.replace(/-\d+$/, "").replace(/-/g, " ") ?? "";
    return clip ? [{ ...clip, id: `pexels:${video.data.id}`, thumb: video.data.image, tags }] : [];
  });
}

// ---------------------------------------------------------------------------

/**
 * Puntuación de un clip para una búsqueda: sobre todo que sus etiquetas digan lo mismo (Pixabay ordena
 * por popularidad, no por parecido) y, a igualdad, que tenga la orientación del vídeo (un clip
 * horizontal que encaja se recorta bien; uno vertical que no encaja no sirve). Las búsquedas
 * alternativas más generales puntúan un poco menos.
 */
export function clipScore(c: StockCandidate, query: string, format: VideoFormat, alternative = 0): number {
  return tagScore(query, c.tags) + (fits(c, format) ? 0.25 : 0) - 0.1 * alternative;
}

/** Ordena los clips de una búsqueda por `clipScore` (a igualdad, el orden del banco de vídeo). */
export function rankCandidates(found: StockCandidate[], query: string, format: VideoFormat): StockCandidate[] {
  return found
    .map((c, i) => ({ c, i, s: clipScore(c, query, format) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map(({ c }) => c);
}

/**
 * Candidatos para una escena: junta los resultados de las dos primeras búsquedas alternativas (y de
 * las siguientes si faltan) en las fuentes con clave y devuelve los `limit` mejores por `clipScore`.
 * Solo clips nítidos para el formato, de 3 s o más y que no estén en `exclude`.
 */
export async function searchCandidates(
  query: string,
  format: VideoFormat,
  limit: number,
  exclude: Set<string> = new Set(),
): Promise<StockCandidate[]> {
  const pool = new Map<string, { c: StockCandidate; s: number; n: number }>();
  const alternatives = queryAlternatives(query);
  for (const [a, alternative] of alternatives.entries()) {
    if (a >= 2 && pool.size >= limit) break;
    for (const search of [searchPixabay, searchPexels]) {
      let found: StockCandidate[] = [];
      try {
        found = await search(alternative, format);
      } catch {
        // una fuente caída no impide usar la otra
      }
      for (const c of found) {
        if (c.duration < 3 || exclude.has(c.id) || upscale(c, format) > MAX_UPSCALE) continue;
        const s = clipScore(c, alternative, format, a);
        const prev = pool.get(c.id);
        if (!prev || s > prev.s) pool.set(c.id, { c, s, n: prev?.n ?? pool.size });
      }
    }
  }
  return [...pool.values()]
    .sort((x, y) => y.s - x.s || x.n - y.n)
    .slice(0, limit)
    .map(({ c }) => c);
}

/** El clip tal como se guarda en el guion (sin id, miniatura ni etiquetas). */
export function toClip(c: StockCandidate): Clip {
  const clip: Clip = { url: c.url, width: c.width, height: c.height, duration: c.duration };
  if (c.page) clip.page = c.page;
  if (c.source) clip.source = c.source;
  return clip;
}
