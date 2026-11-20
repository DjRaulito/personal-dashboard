"use client";

import { useActionState } from "react";
import { setManualBalance } from "@/app/(app)/finanzas/actions";
import { buttonClass, inputClass } from "@/components/ui";
import type { FormState } from "@/lib/finance/schemas";

/** Apuntar el saldo de hoy de una casa de apuestas. */
export function ManualBalanceForm({ accountId, label }: { accountId: string; label: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(setManualBalance, { ok: true });
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={accountId} />
      <input
        name="balance"
        inputMode="decimal"
        required
        placeholder="Saldo de hoy (€)"
        aria-label={`Saldo de hoy en ${label}`}
        className={`${inputClass} w-40`}
      />
      <button type="submit" disabled={pending} className={buttonClass.secondary}>
        Guardar
      </button>
      {state.message && (
        <span role="status" className={state.ok ? "text-finance text-sm" : "text-attention text-sm"}>
          {state.message}
        </span>
      )}
    </form>
  );
}
