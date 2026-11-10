import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { clsx } from "clsx";
import { z } from "zod";
import { CopyField, JobActions, ScriptEditor } from "@/components/studio/job-actions";
import { ProgressBar, statusTone } from "@/components/studio/job-card";
import { LiveStudio } from "@/components/studio/live-studio";
import { BackLink, Tile, TileTitle } from "@/components/ui";
import { driveDownloadUrl, drivePreviewUrl, driveViewUrl } from "@/lib/google/drive";
import {
  AI_VOICES,
  formatDuration,
  JOB_STATUS_LABEL,
  scriptToText,
  type AiVoice,
  type JobStatus,
  type VideoScript,
} from "@/lib/studio/catalog";
import { getJob } from "@/lib/studio/server";

export const metadata: Metadata = { title: "Vídeo · VoiceStudio" };
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export default async function VideoJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const job = await getJob(id);
  if (!job) notFound();
  const status = job.status as JobStatus;
  const script = job.script as unknown as VideoScript | null;
  const running = ["scripting", "queued", "rendering"].includes(status);
  const vertical = job.format === "short";
  const editable = script && (status === "script_ready" || status === "failed");

  return (
    <>
      <LiveStudio active={running} />
      <BackLink href="/contenido/estudio">VoiceStudio</BackLink>
      <div className="grid items-start gap-3.5 lg:grid-cols-5">
        <div className="flex flex-col gap-3.5 lg:col-span-2">
          <Tile>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h2 className="font-display text-2xl leading-tight font-bold tracking-tight">
                {script?.title ?? job.topic.split("\n")[0]}
              </h2>
              <span className={clsx("rounded-full px-2.5 py-0.5 text-xs font-medium", statusTone(status))}>
                {JOB_STATUS_LABEL[status]}
              </span>
            </div>
            <p className="text-muted mt-1 text-sm">
              {vertical ? "Short vertical" : "Vídeo largo"} ·{" "}
              {job.voice_mode === "clone" ? "tu voz" : (AI_VOICES[job.voice as AiVoice] ?? "voz IA")}
              {job.duration_s
                ? ` · ${formatDuration(Number(job.duration_s))}`
                : ` · ~${formatDuration(job.target_seconds)}`}
              {job.auto && " · piloto automático"}
            </p>

            {running && (
              <div className="mt-4 flex flex-col gap-2">
                <ProgressBar value={job.progress} label="Progreso del vídeo" />
                <p className="text-sm">{job.stage}</p>
                <p className="text-muted text-xs">
                  {status === "rendering"
                    ? "El montaje tarda unos minutos (más con tu voz o en vídeos largos). Puedes cerrar esta página."
                    : "Puedes cerrar esta página: sigue solo."}
                  {job.workflow_url && (
                    <>
                      {" "}
                      <a
                        href={job.workflow_url}
                        target="_blank"
                        rel="noreferrer"
                        className="underline underline-offset-2"
                      >
                        Ver en GitHub
                      </a>
                    </>
                  )}
                </p>
              </div>
            )}

            {status === "failed" && job.error && (
              <p role="alert" className="bg-surface-2 rounded-inner text-expense mt-4 px-3.5 py-2.5 text-sm">
                {job.error}
              </p>
            )}

            <div className="mt-5">
              <JobActions
                jobId={job.id}
                status={status}
                hasFile={Boolean(job.drive_file_id)}
                hasScript={Boolean(script)}
              />
            </div>
            {status === "approved" && job.piece_id && (
              <p className="text-muted mt-3 text-sm">
                Aprobado: la pieza está en «Programado».{" "}
                <Link href={`/contenido/pieza/${job.piece_id}`} className="text-text underline underline-offset-2">
                  Ponle fecha de publicación
                </Link>
              </p>
            )}
          </Tile>

          {job.drive_file_id && (
            <Tile className="p-3">
              <div
                className={clsx(
                  "bg-surface-2 rounded-inner mx-auto overflow-hidden",
                  vertical ? "aspect-[9/16] max-h-[70vh]" : "aspect-video w-full",
                )}
              >
                <iframe
                  src={drivePreviewUrl(job.drive_file_id)}
                  title="Vista previa del vídeo"
                  allow="autoplay; fullscreen"
                  className="h-full w-full"
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-2 px-2 pb-1">
                <a
                  href={driveViewUrl(job.drive_file_id)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-content text-sm underline underline-offset-2"
                >
                  Abrir en Drive
                </a>
                <a
                  href={driveDownloadUrl(job.drive_file_id)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-content text-sm underline underline-offset-2"
                >
                  Descargar
                </a>
              </div>
            </Tile>
          )}
        </div>

        <div className="flex flex-col gap-3.5 lg:col-span-3">
          {script && (status === "ready" || status === "approved") && (
            <Tile>
              <TileTitle dot="bg-content">Para publicar</TileTitle>
              <div className="mt-4 flex flex-col gap-4">
                <CopyField label="Título" value={script.title} />
                {(script.description || script.hashtags.length > 0) && (
                  <CopyField
                    label="Descripción y hashtags"
                    value={[script.description, script.hashtags.join(" ")].filter(Boolean).join("\n\n")}
                  />
                )}
              </div>
            </Tile>
          )}

          <Tile>
            <TileTitle dot="bg-content">Guion</TileTitle>
            <div className="mt-4">
              {editable ? (
                <ScriptEditor jobId={job.id} script={script} />
              ) : script ? (
                <p className="text-sm leading-relaxed whitespace-pre-line">{scriptToText(script)}</p>
              ) : (
                <p className="text-muted text-sm">
                  {status === "scripting" ? "La IA lo está escribiendo…" : job.topic}
                </p>
              )}
            </div>
            {script?.scenes.some((s) => s.clips.length > 0) && (
              <p className="text-muted mt-4 text-xs">
                Clips de vídeo de{" "}
                {[...new Set(script.scenes.flatMap((s) => s.clips.map((c) => c.source ?? "Pexels")))].map(
                  (source, i) => (
                    <span key={source}>
                      {i > 0 && " y "}
                      <a
                        href={source === "Pixabay" ? "https://pixabay.com" : "https://www.pexels.com"}
                        target="_blank"
                        rel="noreferrer"
                        className="underline"
                      >
                        {source}
                      </a>
                    </span>
                  ),
                )}{" "}
                (licencia libre).
              </p>
            )}
          </Tile>
        </div>
      </div>
    </>
  );
}
