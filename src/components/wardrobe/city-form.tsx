"use client";

import { useActionState } from "react";
import { saveCity } from "@/app/(app)/armario/actions";
import { buttonClass, Field, FormMessage, inputClass } from "@/components/ui";
import type { FormState } from "@/lib/finance/schemas";

/** Ciudad para el tiempo de los outfits (Ajustes → Armario). */
export function CityForm({ city }: { city: string | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveCity, { ok: true });
  return (
    <form action={action} className="flex flex-col gap-2">
      <div className="flex items-end gap-2">
        <Field label="Tu ciudad (para el tiempo)" error={state.errors?.city} className="min-w-0 flex-1">
          <input
            name="city"
            defaultValue={city ?? ""}
            required
            maxLength={80}
            autoComplete="address-level2"
            className={inputClass}
          />
        </Field>
        <button type="submit" disabled={pending} className={buttonClass.secondary}>
          {pending ? "Buscando…" : "Guardar"}
        </button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
