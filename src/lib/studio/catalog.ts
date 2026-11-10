import { z } from "zod";

// VoiceStudio: formatos, voces, estados y forma del guion que escribe la IA.

export const VIDEO_FORMATS = ["short", "long"] as const;
export type VideoFormat = (typeof VIDEO_FORMATS)[number];

export const VIDEO_FORMAT_LABEL: Record<VideoFormat, string> = {
  short: "Short vertical (9:16)",
  long: "Vídeo largo horizontal (16:9)",
};

/** Duración objetivo en segundos: límites y valor por defecto por formato. */
export const DURATION: Record<VideoFormat, { min: number; max: number; default: number; step: number }> = {
  short: { min: 20, max: 90, default: 60, step: 5 },
  long: { min: 120, max: 720, default: 420, step: 30 },
};

export const VOICE_MODES = ["ai", "clone"] as const;
export type VoiceMode = (typeof VOICE_MODES)[number];

/** Voces de Kokoro en español (el worker las traduce a su id interno). */
export const AI_VOICES = {
  es_male: "Álex (masculina)",
  es_female: "Dora (femenina)",
  es_male_2: "Santa (masculina, grave)",
} as const;
export type AiVoice = keyof typeof AI_VOICES;

export const JOB_STATUSES = [
  "scripting",
  "script_ready",
  "queued",
  "rendering",
  "ready",
  "approved",
  "failed",
  "cancelled",
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  scripting: "Escribiendo guion",
  script_ready: "Guion para revisar",
  queued: "En cola",
  rendering: "Montando",
  ready: "Listo para revisar",
  approved: "Aprobado",
  failed: "Falló",
  cancelled: "Descartado",
};

export const ACTIVE_STATUSES: JobStatus[] = ["scripting", "queued", "rendering"];

/** Palabras por segundo de la narración (español, ritmo de redes). */
export const WORDS_PER_SECOND = 2.6;

/** Escenas aproximadas para una duración: un plano cada ~5 s en shorts y ~9 s en largos. */
export function sceneCount(format: VideoFormat, seconds: number): number {
  const per = format === "short" ? 5 : 9;
  return Math.min(Math.max(Math.round(seconds / per), 3), 80);
}

export const composeSchema = z.object({
  topic: z.string().trim().min(3, "Cuenta de qué va el vídeo").max(2000, "Máximo 2000 caracteres"),
  format: z.enum(VIDEO_FORMATS),
  target_seconds: z.coerce.number().int().min(15).max(900),
  voice_mode: z.enum(VOICE_MODES),
  voice: z.enum(Object.keys(AI_VOICES) as [AiVoice, ...AiVoice[]]),
  piece_id: z
    .uuid()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  review: z.preprocess((v) => v === "on" || v === true, z.boolean()),
});

export const settingsSchema = z.object({
  ai_voice: z.enum(Object.keys(AI_VOICES) as [AiVoice, ...AiVoice[]]),
  autopilot: z.preprocess((v) => v === "on" || v === true, z.boolean()),
  autopilot_days: z.array(z.coerce.number().int().min(0).max(6)).max(7),
  autopilot_format: z.enum(VIDEO_FORMATS),
  autopilot_voice: z.enum(VOICE_MODES),
});

export const VIDEO_MOODS = ["energetic", "chill", "epic"] as const;
export type VideoMood = (typeof VIDEO_MOODS)[number];

/** Texto corto opcional: si la IA se pasa o no lo manda, se ignora en vez de fallar. */
const shortText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .catch(undefined)
    .transform((v) => v || undefined);

/** Un solo emoji (o secuencia con ZWJ); cualquier otra cosa se descarta. */
export function cleanEmoji(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const match = value
    .trim()
    .match(/^\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic}|\p{Emoji_Modifier})*/u);
  return match?.[0];
}

/**
 * Lo que devuelve la IA. `query` va en inglés: los bancos de vídeo (y el generador de imágenes) buscan mejor así.
 * `hook`, `emphasis` y `emoji` son los rótulos animados que salen en pantalla.
 */
export const aiScriptSchema = z.object({
  title: z.string().min(3).max(120),
  hook: shortText(48),
  mood: z.enum(VIDEO_MOODS).catch("energetic"),
  description: z.string().max(2000).default(""),
  hashtags: z.array(z.string().max(40)).max(15).default([]),
  scenes: z
    .array(
      z.object({
        text: z.string().min(2).max(1200),
        query: z.string().min(2).max(120),
        emphasis: shortText(32),
        emoji: z.unknown().optional().transform(cleanEmoji),
      }),
    )
    .min(2)
    .max(90),
});
export type AiScript = z.infer<typeof aiScriptSchema>;

export interface Clip {
  url: string;
  width: number;
  height: number;
  duration: number;
  /** Página del clip (atribución) */
  page?: string;
  /** Pixabay o Pexels */
  source?: string;
}

export interface VideoScript extends AiScript {
  scenes: (AiScript["scenes"][number] & { clips: Clip[] })[];
}

/** Guion completo en texto (para la ficha de contenido). */
export function scriptToText(script: Pick<VideoScript, "scenes">): string {
  return script.scenes.map((s) => s.text.trim()).join("\n\n");
}

/** Palabras totales y duración estimada de la narración. */
export function estimateSeconds(script: Pick<VideoScript, "scenes">): number {
  const words = script.scenes.reduce((n, s) => n + s.text.trim().split(/\s+/).filter(Boolean).length, 0);
  return Math.round(words / WORDS_PER_SECOND);
}

/** Hashtags limpios: sin espacios, con # delante y sin repetir. */
export function cleanHashtags(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const tag = "#" + raw.replace(/^#+/, "").replace(/\s+/g, "");
    const key = tag.toLowerCase();
    if (tag.length < 2 || seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out;
}

export function formatDuration(seconds: number): string {
  const s = Math.round(seconds);
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")} min`;
}
