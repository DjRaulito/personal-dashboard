import Link from "next/link";
import { clsx } from "clsx";
import { formatDateTime } from "@/components/content/format";
import { formatDuration, JOB_STATUS_LABEL, type JobStatus, type VideoScript } from "@/lib/studio/catalog";
import { driveThumbUrl } from "@/lib/google/drive";
import type { VideoJob } from "@/lib/studio/server";

export function statusTone(status: JobStatus): string {
  if (status === "ready") return "bg-attention text-ink";
  if (status === "approved") return "bg-content text-ink";
  if (status === "failed") return "bg-surface-2 text-expense";
  return "bg-surface-2 text-muted";
}

export function ProgressBar({ value, label }: { value: number; label: string }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      className="bg-content/15 h-1.5 overflow-hidden rounded-full"
    >
      <div
        className="bg-content h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none"
        style={{ width: `${Math.max(value, 3)}%` }}
      />
    </div>
  );
}

export function JobCard({ job }: { job: VideoJob }) {
  const status = job.status as JobStatus;
  const script = job.script as unknown as VideoScript | null;
  const running = ["scripting", "queued", "rendering"].includes(status);
  return (
    <Link
      href={`/contenido/estudio/${job.id}`}
      className="hover:bg-surface-2 rounded-inner -mx-2 flex gap-3 px-2 py-3 transition-colors duration-150"
    >
      <div
        className={clsx(
          "bg-surface-2 rounded-inner relative shrink-0 overflow-hidden",
          job.format === "short" ? "h-20 w-12" : "h-12 w-20 self-center",
        )}
      >
        {job.drive_thumb_id && (
          // eslint-disable-next-line @next/next/no-img-element -- miniatura de tu Drive (sesión de Google del navegador)
          <img src={driveThumbUrl(job.drive_thumb_id)} alt="" className="h-full w-full object-cover" loading="lazy" />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="min-w-0 flex-1 truncate font-medium">{script?.title ?? job.topic.split("\n")[0]}</span>
          <span className={clsx("rounded-full px-2.5 py-0.5 text-xs font-medium", statusTone(status))}>
            {JOB_STATUS_LABEL[status]}
          </span>
        </div>
        <p className="text-muted text-xs">
          {job.format === "short" ? "Short" : "Largo"} · {job.voice_mode === "clone" ? "tu voz" : "voz IA"}
          {job.duration_s ? ` · ${formatDuration(Number(job.duration_s))}` : ""}
          {job.auto ? " · piloto automático" : ""} · {formatDateTime(job.created_at)}
        </p>
        {running && (
          <>
            <ProgressBar value={job.progress} label={`Progreso de «${script?.title ?? job.topic.slice(0, 40)}»`} />
            <p className="text-muted text-xs">{job.stage}</p>
          </>
        )}
        {status === "failed" && job.error && <p className="text-expense line-clamp-2 text-xs">{job.error}</p>}
      </div>
    </Link>
  );
}
