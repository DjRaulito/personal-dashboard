// Estudio local: el montaje puede correr en el PC de Raúl (worker `studio/local.py`; la voz la pone el programa VoiceStudio).
// El PC avisa cada ~20 s; si avisó hace poco se considera encendido y la app no lanza GitHub Actions.

/** Mismo margen que la función `studio_worker` (acción `queue`). */
export const LOCAL_ONLINE_MS = 90_000;
/** Si el PC no coge un trabajo en este tiempo, la app lo pasa a GitHub. */
export const LOCAL_PICKUP_MS = 3 * 60_000;
/** Un montaje en el PC sin noticias durante este tiempo se da por perdido (PC apagado, worker cerrado). */
export const LOCAL_STALL_MS = 20 * 60_000;

export type StudioWorker = "github" | "local";

export function localWorkerOnline(seenAt: string | null | undefined, now = Date.now()): boolean {
  if (!seenAt) return false;
  const seen = new Date(seenAt).getTime();
  return Number.isFinite(seen) && now - seen < LOCAL_ONLINE_MS;
}

export type ActiveJob = {
  status: string;
  worker: string | null;
  queued_at: string | null;
  updated_at: string;
};

/**
 * Qué hacer con un trabajo activo según quién lo monta:
 * - «handoff»: estaba esperando al PC y no lo cogió → pasa a GitHub.
 * - «stalled»: lo montaba el PC y dejó de dar noticias.
 * - null: nada que hacer aquí (los de GitHub se revisan con sus ejecuciones).
 */
export function localJobAction(job: ActiveJob, now = Date.now()): "handoff" | "stalled" | null {
  const since = (iso: string | null) => (iso ? now - new Date(iso).getTime() : 0);
  if (job.status === "queued" && job.worker === null && since(job.queued_at) > LOCAL_PICKUP_MS) return "handoff";
  if (job.status === "rendering" && job.worker === "local" && since(job.updated_at) > LOCAL_STALL_MS) return "stalled";
  return null;
}
