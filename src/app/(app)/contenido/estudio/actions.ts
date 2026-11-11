"use server";

import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { hashToken } from "@/lib/brain/schemas";
import { contentSession } from "@/lib/content/server";
import { fieldErrors, type FormState } from "@/lib/finance/schemas";
import { GoogleAuthError, DRIVE_FILE_SCOPE } from "@/lib/google/calendar";
import { deleteDriveFile } from "@/lib/google/drive";
import { getGoogleAccess } from "@/lib/google/server";
import { composeSchema, scriptToText, settingsSchema, type VideoFormat, type VideoScript } from "@/lib/studio/catalog";
import { cancelStudioRun, setRepoSecret, studioGithubConfigured } from "@/lib/studio/github";
import { queueRender, runJob, sessionStore } from "@/lib/studio/pipeline";

const id = z.uuid();
const STUDIO = "/contenido/estudio";

function refresh(jobId?: string) {
  revalidatePath(STUDIO, "layout");
  revalidatePath("/contenido");
  if (jobId) revalidatePath(`${STUDIO}/${jobId}`);
}

/** Token de Google con permiso de Drive, o un mensaje de qué falta. */
async function driveAccess(): Promise<{ token: string } | { error: string }> {
  try {
    const access = await getGoogleAccess();
    if (access.status !== "ok") return { error: "Conecta tu cuenta de Google (cierra sesión y vuelve a entrar)." };
    if (!access.scopes.includes(DRIVE_FILE_SCOPE))
      return { error: "Falta el permiso de Google Drive: cierra sesión y vuelve a entrar con Google." };
    return { token: access.accessToken };
  } catch (error) {
    return {
      error:
        error instanceof GoogleAuthError
          ? "Google rechazó el acceso: cierra sesión y vuelve a entrar."
          : "Google no respondió. Prueba otra vez en un momento.",
    };
  }
}

/** Comprueba lo necesario para montar vídeos (en tu PC o en GitHub); devuelve el primer problema o null. */
async function renderBlocker(): Promise<string | null> {
  const supabase = await contentSession();
  const { data } = await supabase
    .from("studio_settings")
    .select("worker_token_hash, local_token_hash")
    .maybeSingle();
  if (data?.local_token_hash) return null; // tu PC lo monta; GitHub queda de respaldo si está configurado
  if (!studioGithubConfigured())
    return "Falta GITHUB_AGENT_TOKEN en Vercel (lo mismo que para los agentes de Claude Code) o la clave de tu PC.";
  if (!data?.worker_token_hash) return "Falta crear la clave del estudio en Ajustes del VoiceStudio.";
  return null;
}

// ---------------------------------------------------------------------------
// Vídeos
// ---------------------------------------------------------------------------

export async function createVideo(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = composeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const input = parsed.data;
  const supabase = await contentSession();

  if (input.voice_mode === "clone") {
    const { data } = await supabase.from("studio_settings").select("voice_sample_mime").maybeSingle();
    if (!data?.voice_sample_mime)
      return { ok: false, errors: { voice_mode: "Graba antes tu muestra de voz en Ajustes" } };
  }
  let googleToken: string | null = null;
  if (!input.review) {
    const blocker = await renderBlocker();
    if (blocker) return { ok: false, message: blocker };
    const drive = await driveAccess();
    if ("error" in drive) return { ok: false, message: drive.error };
    googleToken = drive.token;
  }

  const { data: job, error } = await supabase
    .from("video_jobs")
    .insert({
      topic: input.topic,
      format: input.format,
      target_seconds: input.target_seconds,
      voice_mode: input.voice_mode,
      voice: input.voice,
      piece_id: input.piece_id ?? null,
      status: "scripting",
      stage: "Escribiendo el guion",
    })
    .select("id, topic, format, target_seconds")
    .single();
  if (error || !job) return { ok: false, message: "No se pudo crear el vídeo." };

  after(() => runJob(sessionStore(supabase), { ...job, format: job.format as VideoFormat }, googleToken, input.review));
  refresh();
  redirect(`${STUDIO}/${job.id}`);
}

/** Guarda los textos de las escenas tras revisarlos (mantiene los clips). */
export async function saveScript(_: FormState, formData: FormData): Promise<FormState> {
  const jobId = id.safeParse(formData.get("id"));
  if (!jobId.success) return { ok: false, message: "Vídeo no válido." };
  const supabase = await contentSession();
  const { data: job } = await supabase.from("video_jobs").select("script, status").eq("id", jobId.data).maybeSingle();
  if (!job?.script || !["script_ready", "failed"].includes(job.status))
    return { ok: false, message: "Este guion ya no se puede editar." };
  const script = job.script as unknown as VideoScript;
  const title =
    String(formData.get("title") ?? "")
      .trim()
      .slice(0, 120) || script.title;
  const scenes = script.scenes
    .map((scene, i) => ({
      ...scene,
      text: String(formData.get(`scene-${i}`) ?? scene.text)
        .trim()
        .slice(0, 1200),
      emphasis:
        String(formData.get(`emphasis-${i}`) ?? scene.emphasis ?? "")
          .trim()
          .slice(0, 32) || undefined,
    }))
    .filter((scene) => scene.text.length > 1);
  if (scenes.length < 2) return { ok: false, message: "Deja al menos dos escenas con texto." };
  const hook =
    String(formData.get("hook") ?? script.hook ?? "")
      .trim()
      .slice(0, 48) || undefined;
  const { error } = await supabase
    .from("video_jobs")
    .update({ script: JSON.parse(JSON.stringify({ ...script, title, hook, scenes })) as never })
    .eq("id", jobId.data);
  if (error) return { ok: false, message: "No se pudo guardar el guion." };
  refresh(jobId.data);
  return { ok: true, message: "Guion guardado." };
}

/** Monta un guion revisado (o reintenta uno que falló). */
export async function renderVideo(jobId: string): Promise<{ ok: boolean; message?: string }> {
  const supabase = await contentSession();
  const { data: job } = await supabase
    .from("video_jobs")
    .select("id, topic, format, target_seconds, script, status")
    .eq("id", id.parse(jobId))
    .maybeSingle();
  if (!job) return { ok: false, message: "No existe el vídeo." };
  const blocker = await renderBlocker();
  if (blocker) return { ok: false, message: blocker };
  const drive = await driveAccess();
  if ("error" in drive) return { ok: false, message: drive.error };

  if (!job.script) {
    // Falló antes de tener guion: se empieza de cero
    await supabase
      .from("video_jobs")
      .update({ status: "scripting", stage: "Escribiendo el guion", error: null, progress: 0 })
      .eq("id", job.id);
    after(() => runJob(sessionStore(supabase), { ...job, format: job.format as VideoFormat }, drive.token, false));
  } else {
    if (!["script_ready", "failed"].includes(job.status)) return { ok: false, message: "Ya está en marcha." };
    try {
      await queueRender(sessionStore(supabase), job.id, (job.script as unknown as VideoScript).title, drive.token);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo lanzar el montaje.";
      await sessionStore(supabase).fail(job.id, message);
      refresh(job.id);
      return { ok: false, message };
    }
  }
  refresh(job.id);
  return { ok: true };
}

/**
 * Aprueba el vídeo: pasa su pieza a «Programado» con el guion (o crea la pieza si venía de un tema
 * suelto). Desde ahí se le pone fecha y va al calendario.
 */
export async function approveVideo(jobId: string): Promise<void> {
  const supabase = await contentSession();
  const { data: job } = await supabase
    .from("video_jobs")
    .select("id, piece_id, format, script, status, topic")
    .eq("id", id.parse(jobId))
    .maybeSingle();
  if (!job || job.status !== "ready") return;
  const script = job.script as unknown as VideoScript | null;
  const text = script ? scriptToText(script) : null;
  const notes = script ? [script.description, script.hashtags.join(" ")].filter(Boolean).join("\n\n") : null;
  let pieceId = job.piece_id;

  if (pieceId) {
    const { data: piece } = await supabase
      .from("content_pieces")
      .select("status, script, notes")
      .eq("id", pieceId)
      .maybeSingle();
    if (piece) {
      await supabase
        .from("content_pieces")
        .update({
          ...(["idea", "script", "recording", "editing"].includes(piece.status) ? { status: "scheduled" } : {}),
          ...(!piece.script && text ? { script: text } : {}),
          ...(!piece.notes && notes ? { notes } : {}),
        })
        .eq("id", pieceId);
    }
  } else {
    const { data: piece } = await supabase
      .from("content_pieces")
      .insert({
        title: script?.title ?? job.topic.slice(0, 200),
        status: "scheduled",
        format: job.format === "long" ? "long" : "short",
        platforms: job.format === "long" ? ["youtube"] : ["tiktok", "instagram", "youtube"],
        script: text,
        notes,
        position: Date.now() / 1000,
      })
      .select("id")
      .single();
    pieceId = piece?.id ?? null;
  }
  await supabase.from("video_jobs").update({ status: "approved", piece_id: pieceId }).eq("id", job.id);
  refresh(job.id);
  if (pieceId) revalidatePath(`/contenido/pieza/${pieceId}`);
}

/** Descarta el vídeo: para el montaje si va en marcha y, si se pide, borra el archivo de Drive. */
export async function discardVideo(jobId: string, deleteFile: boolean): Promise<{ ok: boolean; message?: string }> {
  const supabase = await contentSession();
  const { data: job } = await supabase
    .from("video_jobs")
    .select("id, status, workflow_run_id, drive_file_id, drive_thumb_id")
    .eq("id", id.parse(jobId))
    .maybeSingle();
  if (!job) return { ok: false };
  if (job.workflow_run_id && ["queued", "rendering"].includes(job.status)) {
    await cancelStudioRun(job.workflow_run_id).catch(() => undefined);
  }
  if (deleteFile && (job.drive_file_id || job.drive_thumb_id)) {
    const drive = await driveAccess();
    if ("error" in drive) return { ok: false, message: drive.error };
    for (const fileId of [job.drive_file_id, job.drive_thumb_id]) {
      if (fileId) await deleteDriveFile(drive.token, fileId).catch(() => undefined);
    }
  }
  await supabase
    .from("video_jobs")
    .update({
      status: "cancelled",
      assets: null,
      ...(deleteFile ? { drive_file_id: null, drive_thumb_id: null } : {}),
      finished_at: new Date().toISOString(),
    })
    .eq("id", job.id);
  refresh(job.id);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Ajustes
// ---------------------------------------------------------------------------

export async function saveStudioSettings(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = settingsSchema.safeParse({
    ...Object.fromEntries(formData),
    autopilot_days: formData.getAll("autopilot_days"),
  });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const supabase = await contentSession();
  if (parsed.data.autopilot && parsed.data.autopilot_days.length === 0)
    return { ok: false, errors: { autopilot_days: "Elige al menos un día" } };
  const { error } = await supabase.from("studio_settings").upsert(parsed.data, { onConflict: "user_id" });
  if (error) return { ok: false, message: "No se pudieron guardar los ajustes." };
  refresh();
  return { ok: true, message: "Ajustes guardados." };
}

export interface KeyResult {
  ok: boolean;
  message: string;
  /** Solo si no se pudo guardar sola en GitHub: hay que copiarla a mano (se muestra una vez). */
  token?: string;
}

/**
 * Crea la clave del estudio (la base de datos guarda solo su huella) y la guarda como secreto del
 * repo (STUDIO_WORKER_TOKEN) junto a la dirección de la app (STUDIO_APP_URL) para el piloto automático.
 */
export async function createWorkerKey(): Promise<KeyResult> {
  const supabase = await contentSession();
  const token = `studio_${randomBytes(32).toString("base64url")}`;
  const { error } = await supabase
    .from("studio_settings")
    .upsert({ worker_token_hash: hashToken(token) }, { onConflict: "user_id" });
  if (error) return { ok: false, message: "No se pudo crear la clave." };
  refresh();

  if (!studioGithubConfigured()) {
    return { ok: true, token, message: "Cópiala en GitHub: falta GITHUB_AGENT_TOKEN para guardarla sola." };
  }
  try {
    const h = await headers();
    const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
    await setRepoSecret("STUDIO_WORKER_TOKEN", token);
    await setRepoSecret("STUDIO_APP_URL", origin);
    return { ok: true, message: "Clave creada y guardada en GitHub. Ya está todo listo." };
  } catch {
    return {
      ok: true,
      token,
      message:
        "La clave está creada, pero GitHub no dejó guardarla (el token necesita el permiso «Secrets»). Cópiala a mano.",
    };
  }
}

/**
 * Crea la clave del estudio local (tu PC). Se muestra una sola vez: va en `.env.local` como
 * STUDIO_LOCAL_TOKEN. La base de datos guarda solo su huella; la de GitHub no cambia.
 */
export async function createLocalWorkerKey(): Promise<KeyResult> {
  const supabase = await contentSession();
  const token = `studio_pc_${randomBytes(32).toString("base64url")}`;
  const { error } = await supabase
    .from("studio_settings")
    .upsert({ local_token_hash: hashToken(token) }, { onConflict: "user_id" });
  if (error) return { ok: false, message: "No se pudo crear la clave." };
  refresh();
  return { ok: true, token, message: "Clave creada. Cópiala ahora: no se vuelve a mostrar." };
}

const SAMPLE_TYPES = [
  "audio/webm",
  "audio/ogg",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/x-wav",
  "audio/aac",
  "audio/x-m4a",
];

export async function saveVoiceSample(formData: FormData): Promise<{ ok: boolean; message: string }> {
  const file = formData.get("sample");
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "No llegó ningún audio." };
  if (file.size > 3 * 1024 * 1024)
    return { ok: false, message: "La muestra pesa más de 3 MB: usa una de 1 minuto como mucho." };
  const mime = file.type.split(";")[0] || "audio/webm";
  if (!SAMPLE_TYPES.includes(mime)) return { ok: false, message: "Formato de audio no admitido." };
  const hex = Buffer.from(await file.arrayBuffer()).toString("hex");
  const supabase = await contentSession();
  const { error } = await supabase
    .from("studio_settings")
    .upsert({ voice_sample: `\\x${hex}`, voice_sample_mime: mime }, { onConflict: "user_id" });
  if (error) return { ok: false, message: "No se pudo guardar la muestra." };
  refresh();
  return { ok: true, message: "Muestra guardada. Ya puedes usar tu voz en los vídeos." };
}

export async function deleteVoiceSample(): Promise<void> {
  const supabase = await contentSession();
  await supabase
    .from("studio_settings")
    .update({ voice_sample: null, voice_sample_mime: null, autopilot_voice: "ai" })
    .not("user_id", "is", null);
  refresh();
}

/** Pone al día los vídeos en marcha con GitHub (lo llama la pantalla mientras hay trabajo). */
export async function refreshStudio(): Promise<void> {
  const { syncActiveJobs } = await import("@/lib/studio/server");
  await syncActiveJobs();
}
