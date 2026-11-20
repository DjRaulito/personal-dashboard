"use client";

import { useActionState, useState, useTransition } from "react";
import { deleteListing, saveNotes, setStatus } from "@/app/(app)/tareas/inmuebles/actions";
import { buttonClass, Field, FormMessage, inputClass } from "@/components/ui";
import { STATUS_LABELS, STATUSES, type Status } from "@/lib/realestate/schemas";

export function StatusSelect({ id, status }: { id: string; status: Status }) {
  const [pending, start] = useTransition();
  return (
    <Field label="Tu decisión">
      <select
        defaultValue={status}
        disabled={pending}
        className={inputClass}
        onChange={(e) => {
          const value = e.target.value;
          start(() => setStatus(id, value));
        }}
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function NotesForm({ id, notes, discardReason }: { id: string; notes: string; discardReason: string }) {
  const [state, action, pending] = useActionState(saveNotes, { ok: false });
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={id} />
      <Field label="Notas" error={state.errors?.user_notes}>
        <textarea
          name="user_notes"
          rows={4}
          maxLength={4000}
          defaultValue={notes}
          placeholder="Llamada a la agencia, visita, dudas…"
          className={inputClass}
        />
      </Field>
      <Field label="Motivo de descarte (si lo descartas)" error={state.errors?.discard_reason}>
        <input name="discard_reason" maxLength={300} defaultValue={discardReason} className={inputClass} />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass.secondary}>
          {pending ? "Guardando…" : "Guardar notas"}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function DeleteListingButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className={buttonClass.danger}
      onClick={() => {
        if (confirm("¿Borrar este anuncio y su historial? Si la tarea lo vuelve a encontrar, aparecerá como nuevo."))
          start(() => deleteListing(id));
      }}
    >
      {pending ? "Borrando…" : "Borrar anuncio"}
    </button>
  );
}

export function CopyButton({ text, label = "Copiar" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={buttonClass.secondary}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          setCopied(false);
        }
      }}
    >
      <span aria-live="polite">{copied ? "Copiado" : label}</span>
    </button>
  );
}
