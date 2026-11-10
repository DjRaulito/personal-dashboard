import "server-only";
import { z } from "zod";
import type { Clip, VideoFormat } from "./catalog";

// Clips de vídeo de stock gratuitos (Pexels, licencia libre). Necesita PEXELS_API_KEY (gratis).
// Sin clave, el montaje usa fondos en degradado.

export const pexelsConfigured = () => Boolean(process.env.PEXELS_API_KEY);

const videoSchema = z.object({
  id: z.number(),
  url: z.string(),
  duration: z.number(),
  width: z.number(),
  height: z.number(),
  video_files: z.array(
    z.object({
      link: z.string(),
      width: z.number().nullable(),
      height: z.number().nullable(),
      file_type: z.string().nullable().optional(),
    }),
  ),
});
type PexelsVideo = z.infer<typeof videoSchema>;

/** El archivo más ligero que aún cubra la pantalla (≥ 1080 en el lado corto si existe). */
export function pickFile(video: PexelsVideo): Clip | null {
  const files = video.video_files.filter((f) => f.width && f.height && (f.file_type ?? "video/mp4") === "video/mp4");
  if (!files.length) return null;
  const short = (f: (typeof files)[number]) => Math.min(f.width!, f.height!);
  const target = 1080;
  const big = files.filter((f) => short(f) >= target).sort((a, b) => short(a) - short(b));
  const file = big[0] ?? files.sort((a, b) => short(b) - short(a))[0];
  return { url: file.link, width: file.width!, height: file.height!, duration: video.duration, page: video.url };
}

/** Busca clips para una escena. Devuelve hasta `count`, evitando repetir los ya usados. */
export async function searchClips(
  query: string,
  format: VideoFormat,
  count: number,
  used: Set<number>,
): Promise<Clip[]> {
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
  const clips: Clip[] = [];
  for (const raw of data.videos) {
    const parsed = videoSchema.safeParse(raw);
    if (!parsed.success || used.has(parsed.data.id) || parsed.data.duration < 3) continue;
    const clip = pickFile(parsed.data);
    if (!clip) continue;
    used.add(parsed.data.id);
    clips.push(clip);
    if (clips.length === count) break;
  }
  return clips;
}
