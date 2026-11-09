"use client";

import { useActionState, useEffect, useRef } from "react";
import { addOperation } from "@/app/(app)/finanzas/inversiones/actions";
import { buttonClass, Field, FormMessage, inputClass } from "@/components/ui";

export function OperationForm({ assets, today }: { assets: { id: string; name: string }[]; today: string }) {
  const [state, action, pending] = useActionState(addOperation, { ok: false, message: "" });
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);

  return (
    <form autoComplete="off" ref={ref} action={action} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <Field label="Activo" className="sm:col-span-2">
          <select name="asset_id" required className={inputClass}>
            {assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tipo">
          <select name="type" defaultValue="buy" className={inputClass}>
            <option value="buy">Compra</option>
            <option value="sell">Venta</option>
            <option value="dividend">Dividendo</option>
            <option value="fee">Comisión</option>
          </select>
        </Field>
        <Field label="Fecha">
          <input type="date" name="trade_date" required defaultValue={today} className={inputClass} />
        </Field>
        <Field label="Títulos / participaciones">
          <input name="quantity" inputMode="decimal" defaultValue="0" className={`${inputClass} tabular-nums`} />
        </Field>
        <Field label="Precio (moneda del activo)">
          <input name="price" inputMode="decimal" className={`${inputClass} tabular-nums`} />
        </Field>
        <Field label="Importe total en € (con comisiones)" className="sm:col-span-2">
          <input name="cash_eur" inputMode="decimal" required className={`${inputClass} tabular-nums`} />
        </Field>
        <Field label="Notas" className="sm:col-span-2 lg:col-span-4">
          <input name="notes" maxLength={500} className={inputClass} />
        </Field>
      </div>
      <FormMessage state={state} />
      <div>
        <button type="submit" disabled={pending} className={buttonClass.primary}>
          {pending ? "Guardando…" : "Añadir operación"}
        </button>
      </div>
    </form>
  );
}
