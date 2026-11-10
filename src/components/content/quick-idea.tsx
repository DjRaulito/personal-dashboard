"use client";

import { useActionState, useEffect, useRef } from "react";
import { addIdea } from "@/app/(app)/contenido/actions";
import { buttonClass, Field, FormMessage, inputClass } from "@/components/ui";
import { FORMAT_LABEL, FORMATS, PRIORITY_LABEL } from "@/lib/content/catalog";

export function QuickIdea() {
  const [state, action, pending] = useActionState(addIdea, { ok: false });
  const form = useRef<HTMLFormElement>(null);
  const title = useRef<HTMLInputElement>(null);

  // Tras guardar, se vacía y vuelve el foco para apuntar la siguiente
  useEffect(() => {
    if (state.ok) {
      form.current?.reset();
      title.current?.focus();
    }
  }, [state]);

  return (
    <form ref={form} action={action} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_10rem_8rem_auto] sm:items-end">
        <Field label="Idea" error={state.errors?.title}>
          <input
            ref={title}
            name="title"
            required
            maxLength={200}
            placeholder="Ej.: 3 errores al empezar en el gym…"
            autoComplete="off"
            className={inputClass}
          />
        </Field>
        <Field label="Formato">
          <select name="format" defaultValue="short" className={inputClass}>
            {FORMATS.map((f) => (
              <option key={f} value={f}>
                {FORMAT_LABEL[f]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Prioridad">
          <select name="priority" defaultValue="2" className={inputClass}>
            {[1, 2, 3].map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </select>
        </Field>
        <button type="submit" disabled={pending} className={buttonClass.primary}>
          {pending ? "Guardando…" : "Apuntar"}
        </button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
