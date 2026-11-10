"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { saveTransaction, scanReceipt } from "@/app/(app)/finanzas/actions";
import { PhotoButton } from "@/components/ai/photo-button";
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
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [scanning, startScan] = useTransition();

  // Rellena el formulario con lo leído del ticket; se revisa y se guarda a mano
  function fill(values: Record<string, string | null>) {
    const form = formRef.current;
    if (!form) return;
    for (const [name, value] of Object.entries(values)) {
      const el = form.elements.namedItem(name);
      if (value !== null && (el instanceof HTMLInputElement || el instanceof HTMLSelectElement)) el.value = value;
    }
  }

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
      {!transaction && (
        <div className="flex flex-wrap items-center gap-3">
          <PhotoButton
            label="Leer un ticket"
            busy={scanning}
            onError={setScanMessage}
            onImage={(image) =>
              startScan(async () => {
                setScanMessage(null);
                const res = await scanReceipt(image);
                if (!res.ok) return setScanMessage(res.message);
                const r = res.data;
                fill({
                  description: r.description,
                  booked_on: r.booked_on,
                  amount: r.amount,
                  direction: "gasto",
                  category_id: r.category_id,
                  notes: r.notes,
                });
                setScanMessage("Ticket leído: revisa los datos y pulsa «Añadir movimiento».");
              })
            }
          />
          {scanMessage && (
            <p role="status" className="text-muted text-sm">
              {scanMessage}
            </p>
          )}
        </div>
      )}
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
