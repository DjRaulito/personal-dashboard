import "server-only";
import { createClient as createAnonClient } from "@supabase/supabase-js";
import { askJson } from "@/lib/ai/llm";
import { env } from "@/lib/env";
import { createUploadSession, ensureFolder } from "@/lib/google/drive";
import type { Database, Json } from "@/lib/supabase/database.types";
import {
  aiScriptSchema,
  cleanHashtags,
  sceneCount,
  WORDS_PER_SECOND,
  type Clip,
  type VideoFormat,
  type VideoScript,
} from "./catalog";
import { dispatchStudio } from "./github";
import { searchClips } from "./stock";

// Cadena del VoiceStudio en la app: guion (IA) → clips (Pixabay/Pexels) → sesiones de subida a Drive →
// cola → GitHub Actions. Se usa con la sesión del usuario (pantalla) o con la clave del estudio
// (piloto automático, sin sesión); el «almacén» abstrae esa diferencia.

export interface JobStore {
  setScript(jobId: string, script: VideoScript): Promise<void>;
  queue(jobId: string, assets: Record<string, string>): Promise<void>;
  fail(jobId: string, error: string): Promise<void>;
}

type SessionClient = Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>;

/** Almacén con la sesión del usuario (RLS). */
export function sessionStore(supabase: SessionClient): JobStore {
  return {
    async setScript(jobId, script) {
      const { error } = await supabase
        .from("video_jobs")
        .update({ script: script as unknown as Json, status: "script_ready", stage: "Guion listo", progress: 0 })
        .eq("id", jobId)
        .eq("status", "scripting");
      if (error) throw new Error("No se pudo guardar el guion.");
    },
    async queue(jobId, assets) {
      const { error } = await supabase
        .from("video_jobs")
        .update({
          assets,
          status: "queued",
          stage: "En cola",
          progress: 0,
          error: null,
          queued_at: new Date().toISOString(),
          started_at: null,
          finished_at: null,
          workflow_run_id: null,
          workflow_url: null,
        })
        .eq("id", jobId)
        .in("status", ["script_ready", "failed"]);
      if (error) throw new Error("No se pudo poner en cola.");
    },
    async fail(jobId, message) {
      await supabase
        .from("video_jobs")
        .update({
          status: "failed",
          error: message.slice(0, 2000),
          assets: null,
          finished_at: new Date().toISOString(),
        })
        .eq("id", jobId);
    },
  };
}

/** Almacén con la clave del estudio (función `studio_worker`, sin sesión). */
export function tokenStore(token: string): JobStore & { autopilot(): Promise<AutopilotPick> } {
  const client = createAnonClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  async function call(action: string, jobId: string | null, args: Record<string, unknown> = {}) {
    const { data, error } = await client.rpc("studio_worker", {
      p_token: token,
      p_job: jobId as string,
      p_action: action,
      p_args: args as Json,
    });
    if (error) throw new Error(error.message);
    const result = (data ?? {}) as Record<string, unknown>;
    if (typeof result.error === "string") throw new Error(result.error);
    return result;
  }
  return {
    async setScript(jobId, script) {
      await call("set_script", jobId, { script });
    },
    async queue(jobId, assets) {
      await call("queue", jobId, { assets });
    },
    async fail(jobId, message) {
      await call("fail", jobId, { error: message.slice(0, 2000) });
    },
    async autopilot() {
      return (await call("autopilot", null)) as AutopilotPick;
    },
  };
}

export type AutopilotPick =
  | { skip: string }
  | { job_id: string; topic: string; format: VideoFormat; target_seconds: number; google_token: string | null };

// ---------------------------------------------------------------------------
// Guion
// ---------------------------------------------------------------------------

export async function writeVideoScript(topic: string, format: VideoFormat, seconds: number): Promise<VideoScript> {
  const scenes = sceneCount(format, seconds);
  const words = Math.round(seconds * WORDS_PER_SECOND);
  const ai = await askJson(
    aiScriptSchema,
    [
      "Eres guionista de vídeos para redes sociales en español de España: tono cercano, directo y sin relleno.",
      'Devuelve JSON {"title", "hook", "mood", "description", "hashtags": [], "scenes": [{"text", "query", "emphasis", "emoji"}]}.',
      "El vídeo tiene que ser viral: engancha en el primer segundo, ritmo alto, curiosidad y una promesa clara.",
      "«text» es exactamente lo que dirá la voz en off: frases cortas, naturales al oído, sin emojis, sin",
      "indicaciones de plano, sin listas con viñetas y con los números escritos como se leen.",
      "«query» describe en INGLÉS, con 2-4 palabras concretas, un plano de vídeo de stock que acompañe esa",
      "escena (objetos, lugares, acciones; nunca nombres propios ni texto en pantalla).",
      "«hook» es el rótulo gigante del primer segundo: 2-6 palabras que provoquen (pregunta, cifra o reto).",
      "«emphasis» es el rótulo animado de cada escena: 1-4 palabras o una cifra con la idea clave (p. ej. «+40 % de fuerza», «Error 2: no apuntar»); déjalo vacío en escenas de transición, no lo repitas.",
      "«emoji» es UN emoji que refuerce la escena (o vacío).",
      "«mood» es la música de fondo: energetic, chill o epic.",
      format === "short"
        ? "Formato vertical corto: la primera escena es un gancho que se entiende en 2 segundos y la última invita a seguir la cuenta."
        : "Formato largo horizontal: introducción que promete el valor del vídeo, desarrollo por partes y cierre con resumen y llamada a suscribirse.",
      "«title» de menos de 70 caracteres; «description» de 2-3 frases; 5-8 «hashtags» sin espacios.",
    ].join(" "),
    `Tema: ${topic}\nDuración: unos ${seconds} segundos (≈ ${words} palabras en total).\nEscenas: unas ${scenes}.`,
  );

  // Clips de stock: 1 por escena corta, hasta 3 en escenas largas. Búsquedas de 6 en 6.
  const used = new Set<string>();
  const withClips: VideoScript["scenes"] = [];
  for (let i = 0; i < ai.scenes.length; i += 6) {
    const batch = ai.scenes.slice(i, i + 6);
    const results = await Promise.all(
      batch.map(async (scene) => {
        const sceneSeconds = scene.text.split(/\s+/).length / WORDS_PER_SECOND;
        const count = Math.min(3, Math.max(1, Math.round(sceneSeconds / 4)));
        try {
          return await searchClips(scene.query, format, count, used);
        } catch {
          return [] as Clip[];
        }
      }),
    );
    batch.forEach((scene, k) => withClips.push({ ...scene, clips: results[k] }));
  }
  return { ...ai, hashtags: cleanHashtags(ai.hashtags), scenes: withClips };
}

// ---------------------------------------------------------------------------
// Cola de montaje
// ---------------------------------------------------------------------------

function safeName(title: string): string {
  return (
    title
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 60) || "video"
  );
}

/** Abre las subidas a Drive, pone el trabajo en cola y lanza el workflow. */
export async function queueRender(
  store: JobStore,
  jobId: string,
  title: string,
  googleAccessToken: string,
): Promise<void> {
  const folder = await ensureFolder(googleAccessToken);
  const stamp = new Date().toISOString().slice(0, 10);
  const base = `${stamp}-${safeName(title)}`;
  const [video, thumb] = await Promise.all([
    createUploadSession(googleAccessToken, folder, `${base}.mp4`, "video/mp4"),
    createUploadSession(googleAccessToken, folder, `${base}.jpg`, "image/jpeg"),
  ]);
  await store.queue(jobId, { video_upload_url: video, thumb_upload_url: thumb });
  await dispatchStudio(jobId);
}

/** Guion y, si no hay que revisarlo, montaje. Nunca lanza: los errores quedan en el trabajo. */
export async function runJob(
  store: JobStore,
  job: { id: string; topic: string; format: VideoFormat; target_seconds: number },
  googleAccessToken: string | null,
  review: boolean,
): Promise<void> {
  try {
    const script = await writeVideoScript(job.topic, job.format, job.target_seconds);
    await store.setScript(job.id, script);
    if (review) return;
    if (!googleAccessToken) throw new Error("Falta el permiso de Google Drive: cierra sesión y vuelve a entrar.");
    await queueRender(store, job.id, script.title, googleAccessToken);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    console.error("[estudio]", message);
    try {
      await store.fail(job.id, message);
    } catch {
      // nada más que hacer
    }
  }
}
