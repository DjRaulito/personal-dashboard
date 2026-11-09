"use client";

import { useActionState, useEffect, useRef } from "react";
import { createAsset } from "@/app/(app)/finanzas/inversiones/actions";
import { buttonClass, Field, FormMessage, inputClass } from "@/components/ui";
import { KIND_LABELS } from "@/lib/investments/view";

export function NewAssetForm() {
  const [state, action, pending] = useActionState(createAsset, { ok: false, message: "" });
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="Nombre" className="sm:col-span-2">
          <input name="name" required maxLength={120} placeholder="Plan de pensiones Caser…" className={inputClass} />
        </Field>
        <Field label="ISIN (opcional)">
          <input name="isin" maxLength={12} className={inputClass} />
        </Field>
        <Field label="Tipo">
          <select name="kind" defaultValue="pension" className={inputClass}>
            {Object.entries(KIND_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Precio">
          <select name="price_source" defaultValue="manual" className={inputClass}>
            <option value="manual">A mano</option>
            <option value="yahoo">Automático (Yahoo)</option>
          </select>
        </Field>
      </div>
      <input type="hidden" name="currency" value="EUR" />
      <FormMessage state={state} />
      <div>
        <button type="submit" disabled={pending} className={buttonClass.primary}>
          {pending ? "Creando…" : "Añadir activo"}
        </button>
      </div>
    </form>
  );
}
