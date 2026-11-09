"use client";

import { useActionState, useEffect, useRef } from "react";
import { saveTransaction } from "@/app/(app)/finanzas/actions";
import { buttonClass, Field, FormMessage, inputClass } from "@/components/ui";
import type { categoryOptions } from "@/lib/finance/categories";
import { CategoryOptions } from "./category-select";

export interface TransactionFormValues {
  id: string;
  account_id: string;
  booked_on: string;
  description: string;
  amount_cents: number;
  category_id: string | null;
  notes: string | null;
}

export function TransactionForm({
  accounts,
  categoryGroups,
  transaction,
  today,
  onDone,
}: {
  accounts: { id: string; name: string }[];
  categoryGroups: ReturnType<typeof categoryOptions>;
  transaction?: TransactionFormValues;
  today: string;
  onDone?: () => void;
}) {
  const [state, action, pending] = useActionState(saveTransaction, { ok: false });
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      if (!transaction) formRef.current?.reset();
      onDone?.();
    }
  }, [state, transaction, onDone]);

  const isExpense = transaction ? transaction.amount_cents < 0 : true;

  return (
    <form autoComplete="off" ref={formRef} action={action} className="flex flex-col gap-4">
      {transaction && <input type="hidden" name="id" value={transaction.id} />}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Concepto" error={state.errors?.description} className="sm:col-span-2">
          <input
            name="description"
            required
            maxLength={300}
            defaultValue={transaction?.description}
            className={inputClass}
          />
        </Field>
        <Field label="Fecha" error={state.errors?.booked_on}>
          <input
            type="date"
            name="booked_on"
            required
            defaultValue={transaction?.booked_on ?? today}
            className={inputClass}
          />
        </Field>
        <Field label="Cuenta" error={state.errors?.account_id}>
          <select name="account_id" required defaultValue={transaction?.account_id} className={inputClass}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tipo">
          <select name="direction" defaultValue={isExpense ? "gasto" : "ingreso"} className={inputClass}>
            <option value="gasto">Gasto</option>
            <option value="ingreso">Ingreso</option>
          </select>
        </Field>
        <Field label="Importe" error={state.errors?.amount}>
          <input
            name="amount"
            required
            inputMode="decimal"
            placeholder="0,00"
            defaultValue={
              transaction ? (Math.abs(transaction.amount_cents) / 100).toFixed(2).replace(".", ",") : undefined
            }
            className={`${inputClass} tabular-nums`}
          />
        </Field>
        <Field label="Categoría" className="sm:col-span-2">
          <select name="category_id" defaultValue={transaction?.category_id ?? ""} className={inputClass}>
            <option value="">{transaction ? "Sin categoría" : "Automática (según reglas)"}</option>
            <CategoryOptions groups={categoryGroups} />
          </select>
        </Field>
        <Field label="Notas" className="sm:col-span-2 lg:col-span-4">
          <input name="notes" maxLength={1000} defaultValue={transaction?.notes ?? ""} className={inputClass} />
        </Field>
      </div>
      <FormMessage state={state} />
      <div>
        <button type="submit" disabled={pending} className={buttonClass.primary}>
          {pending ? "Guardando…" : transaction ? "Guardar cambios" : "Añadir movimiento"}
        </button>
      </div>
    </form>
  );
}
