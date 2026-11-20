"use client";

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { clsx } from "clsx";
import { syncBankStatements, type StatementsSyncResult } from "@/app/(app)/finanzas/actions";
import { buttonClass } from "@/components/ui";

/** Botón «Sincronizar extractos»: lee los PDF nuevos de la carpeta «Extractos» de Drive. */
export function SyncStatementsButton() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<StatementsSyncResult | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => setResult(await syncBankStatements()))}
        className={buttonClass.primary}
      >
        <RefreshCw
          aria-hidden="true"
          className={clsx("h-4 w-4", pending && "animate-spin motion-reduce:animate-none")}
        />
        {pending ? "Leyendo extractos…" : "Sincronizar extractos"}
      </button>
      <p role="status" className={clsx("text-sm", result?.ok ? "text-finance" : "text-attention")}>
        {result && (result.ok ? "✓ " : "! ") + result.message}
      </p>
    </div>
  );
}
