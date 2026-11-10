import "server-only";
import { contentSession } from "@/lib/content/server";
import type { Tables } from "@/lib/supabase/database.types";
import { recentStudioRuns, studioGithubConfigured } from "./github";

export type VideoJob = Tables<"video_jobs">;
export type StudioSettings = Omit<Tables<"studio_settings">, "voice_sample"> & { has_voice_sample: boolean };

const JOB_COLUMNS =
  "id, piece_id, topic, format, voice_mode, voice, target_seconds, status, progress, stage, script, auto, workflow_run_id, workflow_url, drive_file_id, drive_thumb_id, duration_s, error, queued_at, started_at, finished_at, created_at, updated_at, user_id, assets";

export async function getJobs(limit = 40): Promise<VideoJob[]> {
  const supabase = await contentSession();
  const { data } = await supabase
    .from("video_jobs")
    .select(JOB_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((j) => ({ ...j, assets: null }));
}

export async function getJob(id: string): Promise<VideoJob | null> {
  const supabase = await contentSession();
  const { data } = await supabase.from("video_jobs").select(JOB_COLUMNS).eq("id", id).maybeSingle();
  return data ? { ...data, assets: null } : null;
}

export async function getStudioSettings(): Promise<StudioSettings | null> {
  const supabase = await contentSession();
  const { data } = await supabase
    .from("studio_settings")
    .select(
      "user_id, worker_token_hash, ai_voice, voice_sample_mime, autopilot, autopilot_days, autopilot_format, autopilot_voice, autopilot_last_on, updated_at",
    )
    .maybeSingle();
  if (!data) return null;
  return { ...data, has_voice_sample: Boolean(data.voice_sample_mime) };
}

const MINUTE = 60_000;

/**
 * Pone al día los trabajos en marcha con lo que dice GitHub: enlace a la ejecución y fallos que el
 * worker no pudo avisar (cancelado, máquina caída). También caduca los que nunca arrancaron.
 */
export async function syncActiveJobs(): Promise<void> {
  const supabase = await contentSession();
  const { data: active } = await supabase
    .from("video_jobs")
    .select("id, status, queued_at, started_at, workflow_url, updated_at")
    .in("status", ["scripting", "queued", "rendering"]);
  if (!active?.length) return;
  const now = Date.now();

  const runs =
    studioGithubConfigured() && active.some((j) => j.queued_at)
      ? await recentStudioRuns(
          new Date(
            Math.min(...active.map((j) => new Date(j.queued_at ?? j.updated_at).getTime())) - 5 * MINUTE,
          ).toISOString(),
        ).catch(() => new Map())
      : new Map();

  for (const job of active) {
    const run = runs.get(job.id);
    const since = (iso: string | null) => (iso ? now - new Date(iso).getTime() : 0);
    let failure: string | null = null;

    if (job.status === "scripting" && since(job.updated_at) > 10 * MINUTE) {
      failure = "La IA tardó demasiado en escribir el guion.";
    } else if (run?.status === "completed" && run.conclusion !== "success") {
      failure =
        run.conclusion === "cancelled" ? "El montaje se canceló en GitHub." : "El montaje falló en GitHub Actions.";
    } else if (job.status === "queued" && !run && since(job.queued_at) > 30 * MINUTE) {
      failure = "GitHub no llegó a arrancar el montaje. Revisa el token de GitHub y vuelve a intentarlo.";
    } else if (job.status === "rendering" && since(job.started_at) > 170 * MINUTE) {
      failure = "El montaje superó el tiempo máximo.";
    }

    if (failure) {
      await supabase
        .from("video_jobs")
        .update({ status: "failed", error: failure, assets: null, finished_at: new Date().toISOString() })
        .eq("id", job.id)
        .in("status", ["scripting", "queued", "rendering"]);
    } else if (run && job.workflow_url !== run.url) {
      await supabase.from("video_jobs").update({ workflow_run_id: run.id, workflow_url: run.url }).eq("id", job.id);
    }
  }
}
