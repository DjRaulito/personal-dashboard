"use client";

import { useActionState } from "react";
import { saveMonthlySalary } from "@/app/(app)/finanzas/actions";
import { buttonClass, Field, FormMessage, inputClass } from "@/components/ui";
import type { FormState } from "@/lib/finance/schemas";

/** Salario neto de respaldo: solo se usa en el mes en curso mientras no llegue la nómina. */
export function SalaryForm({ cents }: { cents: number | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveMonthlySalary, { ok: true });
  return (
    <form action={action} className="flex flex-col gap-3">
      <Field label="Salario neto al mes (€)">
        <input
          name="salary"
          inputMode="decimal"
          defaultValue={cents == null ? "" : (cents / 100).toString().replace(".", ",")}
          placeholder="Vacío: solo las nóminas de los extractos"
          className={inputClass}
        />
      </Field>
      <div>
        <button type="submit" disabled={pending} className={buttonClass.secondary}>
          Guardar
        </button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
