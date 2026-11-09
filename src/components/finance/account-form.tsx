"use client";

import { useActionState, useEffect, useRef } from "react";
import { saveAccount } from "@/app/(app)/finanzas/actions";
import { buttonClass, Field, FormMessage, inputClass } from "@/components/ui";
import { ACCOUNT_TYPE_LABELS, ACCOUNT_TYPES, type Account } from "@/lib/finance/accounts";
import { CURRENCIES } from "@/lib/profile";

function centsToInput(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function AccountForm({ account, onDone }: { account?: Account; onDone?: () => void }) {
  const [state, action, pending] = useActionState(saveAccount, { ok: false });
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      if (!account) formRef.current?.reset();
      onDone?.();
    }
  }, [state, account, onDone]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-4">
      {account && <input type="hidden" name="id" value={account.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre" error={state.errors?.name}>
          <input name="name" required maxLength={60} defaultValue={account?.name} className={inputClass} />
        </Field>
        <Field label="Tipo" error={state.errors?.type}>
          <select name="type" defaultValue={account?.type ?? "bank"} className={inputClass}>
            {ACCOUNT_TYPES.map((t) => (
              <option key={t} value={t}>
                {ACCOUNT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Saldo inicial" error={state.errors?.initial_balance}>
          <input
            name="initial_balance"
            inputMode="decimal"
            defaultValue={account ? centsToInput(account.initial_balance_cents) : "0,00"}
            className={`${inputClass} tabular-nums`}
          />
        </Field>
        <Field label="Moneda">
          <select name="currency" defaultValue={account?.currency ?? "EUR"} className={inputClass}>
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
      </div>
      <p className="text-muted text-xs">
        El saldo inicial es el que tenía la cuenta antes del primer movimiento que registres o importes.
      </p>
      <FormMessage state={state} />
      <div>
        <button type="submit" disabled={pending} className={buttonClass.primary}>
          {pending ? "Guardando…" : account ? "Guardar cambios" : "Crear cuenta"}
        </button>
      </div>
    </form>
  );
}
