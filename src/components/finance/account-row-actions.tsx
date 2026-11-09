"use client";

import { useState, useTransition } from "react";
import { deleteAccount, setAccountArchived } from "@/app/(app)/finanzas/actions";
import { buttonClass } from "@/components/ui";
import type { Account } from "@/lib/finance/accounts";
import { AccountForm } from "./account-form";

export function AccountRowActions({ account }: { account: Account }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <div className="flex flex-wrap gap-1">
        <button type="button" className={buttonClass.secondary} onClick={() => setEditing((v) => !v)}>
          {editing ? "Cerrar" : "Editar"}
        </button>
        <button
          type="button"
          disabled={pending}
          className={buttonClass.secondary}
          onClick={() => startTransition(() => setAccountArchived(account.id, !account.archived))}
        >
          {account.archived ? "Reactivar" : "Archivar"}
        </button>
        <button
          type="button"
          disabled={pending}
          className={buttonClass.danger}
          onClick={() => {
            if (confirm(`¿Borrar "${account.name}" y todos sus movimientos? No se puede deshacer.`)) {
              startTransition(() => deleteAccount(account.id));
            }
          }}
        >
          Borrar
        </button>
      </div>
      {editing && (
        <div className="bg-surface-2 rounded-inner mt-3 w-full p-4">
          <AccountForm account={account} onDone={() => setEditing(false)} />
        </div>
      )}
    </>
  );
}
