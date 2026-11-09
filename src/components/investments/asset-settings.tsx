"use client";

import { useActionState } from "react";
import { addManualPrice, updateAsset } from "@/app/(app)/finanzas/inversiones/actions";
import { buttonClass, Field, FormMessage, inputClass } from "@/components/ui";
import { KIND_LABELS } from "@/lib/investments/view";

export function AssetSettings({
  asset,
  today,
}: {
  asset: {
    id: string;
    name: string;
    kind: string;
    price_source: string;
    price_symbol: string | null;
    currency: string;
  };
  today: string;
}) {
  const [state, action, pending] = useActionState(updateAsset, { ok: false, message: "" });
  const [priceState, priceAction, pricePending] = useActionState(addManualPrice, { ok: false, message: "" });
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="id" value={asset.id} />
        <Field label="Nombre">
          <input name="name" defaultValue={asset.name} maxLength={120} required className={inputClass} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tipo">
            <select name="kind" defaultValue={asset.kind} className={inputClass}>
              {Object.entries(KIND_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Precio">
            <select name="price_source" defaultValue={asset.price_source} className={inputClass}>
              <option value="yahoo">Automático (Yahoo Finance)</option>
              <option value="manual">A mano</option>
            </select>
          </Field>
        </div>
        <Field label="Símbolo en Yahoo Finance (vacío = buscar por ISIN)">
          <input name="price_symbol" defaultValue={asset.price_symbol ?? ""} maxLength={40} className={inputClass} />
        </Field>
        <FormMessage state={state} />
        <div>
          <button type="submit" disabled={pending} className={buttonClass.primary}>
            Guardar
          </button>
        </div>
      </form>
      <form action={priceAction} className="flex flex-col gap-4">
        <input type="hidden" name="asset_id" value={asset.id} />
        <p className="text-muted text-sm">
          Para planes de pensiones u otros activos sin cotización: añade el valor liquidativo de una fecha.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Fecha">
            <input type="date" name="price_date" defaultValue={today} required className={inputClass} />
          </Field>
          <Field label={`Precio (${asset.currency})`}>
            <input name="close" inputMode="decimal" required className={`${inputClass} tabular-nums`} />
          </Field>
        </div>
        <FormMessage state={priceState} />
        <div>
          <button type="submit" disabled={pricePending} className={buttonClass.secondary}>
            Añadir precio
          </button>
        </div>
      </form>
    </div>
  );
}
