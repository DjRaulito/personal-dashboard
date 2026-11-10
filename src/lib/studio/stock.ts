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

/** El archivo más ligero que aún cubra la pantalla (≥ 1080 en el lado corto si existe). */
export function pickBest<T extends Candidate>(files: T[]): T | null {
  const ok = files.filter((f) => f.url && f.width > 0 && f.height > 0);
  if (!ok.length) return null;
  const short = (f: T) => Math.min(f.width, f.height);
  const big = ok.filter((f) => short(f) >= 1080).sort((a, b) => short(a) - short(b));
  return big[0] ?? [...ok].sort((a, b) => short(b) - short(a))[0];
}

/** Vertical para shorts, horizontal para vídeos largos. */
const fits = (c: Candidate, format: VideoFormat) => (format === "short" ? c.height > c.width : c.width >= c.height);

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

export function pixabayClip(hit: PixabayHit): Clip | null {
  const files = Object.values(hit.videos)
    .filter((f): f is NonNullable<typeof f> => Boolean(f?.url))
    .map((f) => ({ url: f.url!, width: f.width ?? 0, height: f.height ?? 0 }));
  const file = pickBest(files);
  if (!file) return null;
  return { ...file, duration: hit.duration, page: hit.pageURL, source: "Pixabay" };
}

async function searchPixabay(query: string): Promise<(Clip & { id: string })[]> {
  const key = process.env.PIXABAY_API_KEY;
  if (!key) return [];
  const params = new URLSearchParams({
    key,
    q: query.slice(0, 100),
    video_type: "film",
    safesearch: "true",
    per_page: "20",
  });
  const res = await fetch(`https://pixabay.com/api/videos/?${params}`, {
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Pixabay ${res.status}`);
  const data = z.object({ hits: z.array(z.unknown()).default([]) }).parse(await res.json());
  return data.hits.flatMap((raw) => {
    const hit = pixabayHit.safeParse(raw);
    const clip = hit.success ? pixabayClip(hit.data) : null;
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

export function pexelsClip(video: PexelsVideo): Clip | null {
  const files = video.video_files
    .filter((f) => (f.file_type ?? "video/mp4") === "video/mp4")
    .map((f) => ({ url: f.link, width: f.width ?? 0, height: f.height ?? 0 }));
  const file = pickBest(files);
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
    size: "medium",
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
    const clip = video.success ? pexelsClip(video.data) : null;
    return clip ? [{ ...clip, id: `pexels:${video.data!.id}` }] : [];
  });
}

// ---------------------------------------------------------------------------

/**
 * Busca clips para una escena en las fuentes con clave. Devuelve hasta `count`, sin repetir los ya
 * usados y con los de la orientación del vídeo primero (los otros se recortan en el montaje).
 */
export async function searchClips(
  query: string,
  format: VideoFormat,
  count: number,
  used: Set<string>,
): Promise<Clip[]> {
  const found: (Clip & { id: string })[] = [];
  for (const search of [searchPixabay, searchPexels]) {
    try {
      found.push(...(await search(query, format)));
    } catch {
      // una fuente caída no impide usar la otra
    }
    if (found.filter((c) => fits(c, format) && !used.has(c.id)).length >= count) break;
  }
  const ranked = found
    .filter((c) => c.duration >= 3 && !used.has(c.id))
    .sort((a, b) => Number(fits(b, format)) - Number(fits(a, format)));
  const clips: Clip[] = [];
  for (const { id, ...clip } of ranked) {
    if (used.has(id)) continue;
    used.add(id);
    clips.push(clip);
    if (clips.length === count) break;
  }
  return clips;
}
