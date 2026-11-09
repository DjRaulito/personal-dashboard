import type { Metadata } from "next";
import Link from "next/link";
import { AccountForm } from "@/components/finance/account-form";
import { AccountRowActions } from "@/components/finance/account-row-actions";
import { EmptyState, Tile, TileTitle } from "@/components/ui";
import { ACCOUNT_TYPE_LABELS } from "@/lib/finance/accounts";
import { formatCents } from "@/lib/finance/money";
import { getAccounts } from "@/lib/finance/server";

export const metadata: Metadata = { title: "Cuentas · Finanzas" };

export default async function AccountsPage() {
  const accounts = await getAccounts();
  const active = accounts.filter((a) => !a.archived);
  const archived = accounts.filter((a) => a.archived);

  return (
    <div className="grid gap-3.5 lg:grid-cols-5">
      <Tile className="lg:col-span-3">
        <TileTitle>Tus cuentas</TileTitle>
        {accounts.length === 0 ? (
          <EmptyState>Aún no tienes cuentas. Crea la primera para registrar o importar movimientos.</EmptyState>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {[...active, ...archived].map((a) => (
              <li key={a.id} className="bg-surface-2 rounded-inner flex flex-wrap items-center gap-x-4 gap-y-3 p-4">
                <div className="min-w-0 flex-1">
                  <Link href={`/finanzas/movimientos?cuenta=${a.id}`} className="font-semibold hover:underline">
                    {a.name}
                  </Link>
                  <p className="text-muted text-sm">
                    {ACCOUNT_TYPE_LABELS[a.type]}
                    {a.archived && " · archivada"}
                  </p>
                </div>
                <p className="font-display text-xl font-extrabold tracking-tight tabular-nums">
                  {formatCents(a.balance_cents, a.currency)}
                </p>
                <div className="basis-full">
                  <AccountRowActions account={a} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Tile>
      <Tile className="lg:col-span-2">
        <TileTitle>Nueva cuenta</TileTitle>
        <div className="mt-4">
          <AccountForm />
        </div>
      </Tile>
    </div>
  );
}
