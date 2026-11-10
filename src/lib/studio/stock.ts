import "server-only";
import { z } from "zod";
import type { Clip, VideoFormat } from "./catalog";

// Clips de vídeo de stock gratuitos y sin atribución obligatoria: Pixabay (principal) y Pexels
// (si hay clave; Pexels ya no da claves nuevas). Sin ninguna, el montaje usa imágenes IA o fondos
// animados generados.

export const stockConfigured = () => Boolean(process.env.PIXABAY_API_KEY || process.env.PEXELS_API_KEY);

/** Fuentes con clave, para mostrarlas en la app. */
export const stockSources = () =>
  [process.env.PIXABAY_API_KEY && "Pixabay", process.env.PEXELS_API_KEY && "Pexels"].filter(Boolean) as string[];

interface Candidate {
  url: string;
  width: number;
  height: number;
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

// ---------------------------------------------------------------------------
// Pixabay
// ---------------------------------------------------------------------------

const pixabayFile = z.object({ url: z.string(), width: z.number(), height: z.number() });
const pixabayHit = z.object({
  id: z.number(),
  pageURL: z.string(),
  duration: z.number(),
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

async function searchPixabay(query: string, format: VideoFormat): Promise<(Clip & { id: string })[]> {
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
    const clip = hit.success ? pixabayClip(hit.data, format) : null;
    return clip ? [{ ...clip, id: `pixabay:${hit.data!.id}` }] : [];
  });
}

// ---------------------------------------------------------------------------
// Pexels
// ---------------------------------------------------------------------------

const pexelsVideo = z.object({
  id: z.number(),
  url: z.string(),
  duration: z.number(),
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

async function searchPexels(query: string, format: VideoFormat): Promise<(Clip & { id: string })[]> {
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
    const clip = video.success ? pexelsClip(video.data, format) : null;
    return clip ? [{ ...clip, id: `pexels:${video.data!.id}` }] : [];
  });
}

// ---------------------------------------------------------------------------

/**
 * Busca clips para una escena: prueba las búsquedas alternativas (de la más concreta a la más
 * general) en las fuentes con clave hasta reunir `count`. Solo acepta clips nítidos para el formato
 * (si no hay, la escena usa una imagen IA), sin repetir y con los de la orientación del vídeo primero.
 */
export async function searchClips(
  query: string,
  format: VideoFormat,
  count: number,
  used: Set<string>,
): Promise<Clip[]> {
  const clips: Clip[] = [];
  for (const alternative of queryAlternatives(query)) {
    for (const search of [searchPixabay, searchPexels]) {
      let found: (Clip & { id: string })[] = [];
      try {
        found = await search(alternative, format);
      } catch {
        // una fuente caída no impide usar la otra
      }
      const ranked = found
        .filter((c) => c.duration >= 3 && !used.has(c.id) && upscale(c, format) <= MAX_UPSCALE)
        .sort((a, b) => Number(fits(b, format)) - Number(fits(a, format)));
      for (const { id, ...clip } of ranked) {
        if (clips.length === count) break;
        used.add(id);
        clips.push(clip);
      }
      if (clips.length === count) return clips;
    }
  }
  return clips;
}
