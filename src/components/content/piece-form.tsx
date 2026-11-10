"use client";

import { useActionState, useState, useTransition } from "react";
import { clsx } from "clsx";
import { deletePiece, savePiece, writeScriptWithAi } from "@/app/(app)/contenido/actions";
import { buttonClass, Field, FormMessage, inputClass } from "@/components/ui";
import {
  FORMAT_LABEL,
  FORMATS,
  PLATFORM_LABEL,
  PLATFORMS,
  PRIORITY_LABEL,
  STATUS_LABEL,
  STATUSES,
  type PieceFormat,
  type PieceStatus,
  type Platform,
} from "@/lib/content/catalog";

export interface PieceFormValues {
  id?: string;
  title: string;
  status: PieceStatus;
  format: PieceFormat;
  platforms: Platform[];
  priority: number;
  tags: string[];
  script: string;
  notes: string;
  links: string[];
  publish_at: string; // datetime-local en hora de Madrid
  published_url: string;
}

export function PieceForm({ piece, aiReady }: { piece: PieceFormValues; aiReady: boolean }) {
  const [state, action, pending] = useActionState(savePiece, { ok: false });
  const [deleting, startDelete] = useTransition();
  const [writing, startWriting] = useTransition();
  const [aiMessage, setAiMessage] = useState<{ ok: boolean; message: string } | null>(null);
  const [status, setStatus] = useState<PieceStatus>(piece.status);

  return (
    <form action={action} className="flex flex-col gap-5">
      {piece.id && <input type="hidden" name="id" value={piece.id} />}

      <Field label="Título" error={state.errors?.title}>
        <input name="title" defaultValue={piece.title} required maxLength={200} className={inputClass} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Estado" error={state.errors?.status}>
          <select
            name="status"
            value={status}
            onChange={(e) => setStatus(e.target.value as PieceStatus)}
            className={inputClass}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Formato" error={state.errors?.format}>
          <select name="format" defaultValue={piece.format} className={inputClass}>
            {FORMATS.map((f) => (
              <option key={f} value={f}>
                {FORMAT_LABEL[f]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Prioridad" error={state.errors?.priority}>
          <select name="priority" defaultValue={String(piece.priority)} className={inputClass}>
            {[1, 2, 3].map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-muted mb-1.5 text-sm">Plataformas</legend>
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map((p) => (
            <label
              key={p}
              className="bg-surface-2 has-[:checked]:bg-content has-[:checked]:text-ink has-[:focus-visible]:outline-content flex cursor-pointer items-center rounded-full px-3.5 py-1.5 text-sm transition-colors duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2"
            >
              <input
                type="checkbox"
                name="platforms"
                value={p}
                defaultChecked={piece.platforms.includes(p)}
                className="sr-only"
              />
              {PLATFORM_LABEL[p]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Fecha de publicación" error={state.errors?.publish_at}>
          <input name="publish_at" type="datetime-local" defaultValue={piece.publish_at} className={inputClass} />
        </Field>
        <Field label="Etiquetas (separadas por comas)" error={state.errors?.tags}>
          <input name="tags" defaultValue={piece.tags.join(", ")} maxLength={300} className={inputClass} />
        </Field>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="piece-script" className="text-muted text-sm">
            Guion
          </label>
          {piece.id && (
            <button
              type="button"
              disabled={!aiReady || writing}
              title={aiReady ? undefined : "Falta configurar GEMINI_API_KEY"}
              onClick={() => {
                if (piece.script && !confirm("¿Reescribir el guion con IA? Se sustituye el actual.")) return;
                setAiMessage(null);
                startWriting(async () => setAiMessage(await writeScriptWithAi(piece.id!)));
              }}
              className={buttonClass.secondary}
            >
              {writing ? "Escribiendo…" : piece.script ? "Reescribir con IA" : "Escribir con IA"}
            </button>
          )}
        </div>
        <textarea
          id="piece-script"
          name="script"
          defaultValue={piece.script}
          rows={12}
          maxLength={20000}
          className={clsx(inputClass, "resize-y leading-relaxed")}
        />
        {state.errors?.script && <span className="text-attention text-xs">{state.errors.script}</span>}
        {aiMessage && <FormMessage state={aiMessage} />}
      </div>

      <Field label="Notas" error={state.errors?.notes}>
        <textarea
          name="notes"
          defaultValue={piece.notes}
          rows={3}
          maxLength={5000}
          className={clsx(inputClass, "resize-y")}
        />
      </Field>

      <Field label="Enlaces de referencia (uno por línea)" error={state.errors?.links}>
        <textarea
          name="links"
          defaultValue={piece.links.join("\n")}
          rows={2}
          className={clsx(inputClass, "resize-y")}
        />
      </Field>

      {(status === "published" || piece.published_url) && (
        <Field label="Enlace de la publicación" error={state.errors?.published_url}>
          <input
            name="published_url"
            type="url"
            defaultValue={piece.published_url}
            maxLength={500}
            placeholder="https://…"
            className={inputClass}
          />
        </Field>
      )}

      <FormMessage state={state} />
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={pending} className={buttonClass.primary}>
          {pending ? "Guardando…" : piece.id ? "Guardar cambios" : "Crear pieza"}
        </button>
        {piece.id && (
          <button
            type="button"
            disabled={deleting}
            onClick={() => {
              if (confirm(`¿Borrar «${piece.title}»? Se borran también sus métricas y su evento del calendario.`))
                startDelete(() => deletePiece(piece.id!));
            }}
            className={buttonClass.danger}
          >
            {deleting ? "Borrando…" : "Borrar pieza"}
          </button>
        )}
      </div>
    </form>
  );
}
