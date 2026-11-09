"use client";

import { useActionState, useEffect, useRef } from "react";
import { saveRule } from "@/app/(app)/finanzas/actions";
import { buttonClass, Field, FormMessage, inputClass } from "@/components/ui";
import type { categoryOptions } from "@/lib/finance/categories";
import { CategoryOptions } from "./category-select";

export function RuleForm({
  categoryGroups,
  defaultPattern,
  defaultCategory,
}: {
  categoryGroups: ReturnType<typeof categoryOptions>;
  defaultPattern?: string;
  defaultCategory?: string;
}) {
  const [state, action, pending] = useActionState(saveRule, { ok: false });
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Si el concepto…" error={state.errors?.match_type}>
          <select name="match_type" defaultValue="contains" className={inputClass}>
            <option value="contains">contiene la palabra o frase</option>
            <option value="starts_with">empieza por</option>
            <option value="equals">es exactamente</option>
          </select>
        </Field>
        <Field label="Texto" error={state.errors?.pattern}>
          <input name="pattern" required maxLength={100} defaultValue={defaultPattern} className={inputClass} />
        </Field>
        <Field label="Aplicar a" error={state.errors?.amount_sign}>
          <select name="amount_sign" defaultValue="any" className={inputClass}>
            <option value="any">Gastos e ingresos</option>
            <option value="expense">Solo gastos</option>
            <option value="income">Solo ingresos</option>
          </select>
        </Field>
        <Field label="Categoría" error={state.errors?.category_id}>
          <select name="category_id" required defaultValue={defaultCategory ?? ""} className={inputClass}>
            <option value="" disabled>
              Elegir…
            </option>
            <CategoryOptions groups={categoryGroups} />
          </select>
        </Field>
        <Field label="Prioridad (menor = antes)" error={state.errors?.priority}>
          <input
            name="priority"
            type="number"
            min={0}
            max={1000}
            defaultValue={40}
            className={`${inputClass} tabular-nums`}
          />
        </Field>
        <label className="flex items-center gap-2 self-end pb-2.5 text-sm">
          <input type="checkbox" name="apply_now" defaultChecked className="accent-finance h-4 w-4" />
          Aplicar ya a los movimientos sin categoría
        </label>
      </div>
      <FormMessage state={state} />
      <div>
        <button type="submit" disabled={pending} className={buttonClass.primary}>
          {pending ? "Guardando…" : "Crear regla"}
        </button>
      </div>
    </form>
  );
}
