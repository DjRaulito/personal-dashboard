"use client";

import { useActionState, useState, useTransition } from "react";
import { clsx } from "clsx";
import { useRouter } from "next/navigation";
import { approveVideo, discardVideo, renderVideo, saveScript } from "@/app/(app)/contenido/estudio/actions";
import { buttonClass, FormMessage, inputClass } from "@/components/ui";
import { estimateSeconds, formatDuration, type VideoScript } from "@/lib/studio/catalog";

export function JobActions({
  jobId,
  status,
  hasFile,
  hasScript,
}: {
  jobId: string;
  status: string;
  hasFile: boolean;
  hasScript: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; message: string } | null>(null);
  const running = ["scripting", "queued", "rendering"].includes(status);

  function render() {
    setMessage(null);
    start(async () => {
      const result = await renderVideo(jobId);
      if (!result.ok) setMessage({ ok: false, message: result.message ?? "No se pudo lanzar el montaje." });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {status === "ready" && (
          <button
            type="button"
            disabled={pending}
            onClick={() => start(() => approveVideo(jobId))}
            className={buttonClass.primary}
          >
            Aprobar
          </button>
        )}
        {status === "script_ready" && (
          <button type="button" disabled={pending} onClick={render} className={buttonClass.primary}>
            {pending ? "Lanzando…" : "Montar vídeo"}
          </button>
        )}
        {status === "failed" && (
          <button type="button" disabled={pending} onClick={render} className={buttonClass.secondary}>
            {pending ? "Lanzando…" : hasScript ? "Reintentar el montaje" : "Reintentar"}
          </button>
        )}
        {!["cancelled", "approved"].includes(status) && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              const text = running
                ? "¿Parar y descartar este vídeo?"
                : hasFile
                  ? "¿Descartar este vídeo? También se borra de tu Google Drive."
                  : "¿Descartar este vídeo?";
              if (!confirm(text)) return;
              start(async () => {
                const result = await discardVideo(jobId, hasFile);
                if (!result.ok && result.message) setMessage({ ok: false, message: result.message });
                router.refresh();
              });
            }}
            className={buttonClass.danger}
          >
            {running ? "Parar" : "Descartar"}
          </button>
        )}
      </div>
      {message && <FormMessage state={message} />}
    </div>
  );
}

export function ScriptEditor({ jobId, script }: { jobId: string; script: VideoScript }) {
  const [state, action, pending] = useActionState(saveScript, { ok: false });
  const [scenes, setScenes] = useState(script.scenes.map((s) => s.text));
  const seconds = estimateSeconds({ scenes: scenes.map((text) => ({ text })) as VideoScript["scenes"] });
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={jobId} />
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-muted">Título</span>
        <input name="title" defaultValue={script.title} maxLength={120} className={inputClass} />
      </label>
      <ol className="flex flex-col gap-3">
        {script.scenes.map((scene, i) => (
          <li key={i} className="flex flex-col gap-1.5 text-sm">
            <label htmlFor={`scene-${i}`} className="text-muted flex justify-between gap-2">
              <span>Escena {i + 1}</span>
              <span className="truncate text-xs">
                Plano: {scene.query}
                {scene.clips.length === 0 && " · fondo liso"}
              </span>
            </label>
            <textarea
              id={`scene-${i}`}
              name={`scene-${i}`}
              value={scenes[i]}
              onChange={(e) => setScenes((prev) => prev.map((t, k) => (k === i ? e.target.value : t)))}
              rows={2}
              maxLength={1200}
              className={clsx(inputClass, "resize-y leading-relaxed")}
            />
          </li>
        ))}
      </ol>
      <p className="text-muted text-xs">
        Duración estimada: {formatDuration(seconds)}. Deja una escena vacía para quitarla.
      </p>
      <FormMessage state={state} />
      <button type="submit" disabled={pending} className={clsx(buttonClass.secondary, "self-start")}>
        {pending ? "Guardando…" : "Guardar guion"}
      </button>
    </form>
  );
}

export function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted">{label}</span>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="text-content hover:bg-surface-2 focus-visible:outline-content rounded-full px-2.5 py-0.5 text-xs font-medium focus-visible:outline-2"
        >
          <span aria-live="polite">{copied ? "Copiado" : "Copiar"}</span>
        </button>
      </div>
      <p className="bg-surface-2 rounded-inner px-3.5 py-2.5 whitespace-pre-line">{value}</p>
    </div>
  );
}
