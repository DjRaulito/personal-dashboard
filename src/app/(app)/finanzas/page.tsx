import type { Metadata } from "next";
import Link from "next/link";
import { NetWorthChart } from "@/components/finance/charts";
import { AllocationBar } from "@/components/investments/charts";
import { buttonClass, EmptyState, Tile, TileTitle } from "@/components/ui";
import { ACCOUNT_TYPE_LABELS } from "@/lib/finance/accounts";
import { formatCents } from "@/lib/finance/money";
import { financePeriods, monthsBetween } from "@/lib/finance/periods";
import { getAccounts } from "@/lib/finance/server";
import { getPortfolio } from "@/lib/investments/server";
import { monthEndValues, positionRows } from "@/lib/investments/view";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Patrimonio · Finanzas" };

export default async function NetWorthPage() {
  const p = financePeriods(new Date(), 24);
  const supabase = await createClient();
  const [accounts, pf, accountHistory] = await Promise.all([
    getAccounts(),
    getPortfolio(),
    supabase.rpc("net_worth_by_month", { p_from: p.windowStart, p_to: p.monthStart }),
  ]);

  if (accounts.length === 0 && pf.operations.length === 0) {
    return (
      <Tile>
        <EmptyState>Crea tus cuentas e importa tu cartera para ver tu patrimonio.</EmptyState>
        <div className="flex justify-center gap-2">
          <Link href="/finanzas/cuentas" className={buttonClass.secondary}>
            Crear cuentas
          </Link>
          <Link href="/finanzas/inversiones/importar" className={buttonClass.primary}>
            Importar cartera
          </Link>
        </div>
      </Tile>
    );
  }

  const cash = accounts.reduce((s, a) => s + a.balance_cents, 0);
  const rows = positionRows(pf.input, pf.positions, pf.assets);
  const invested = Math.round(rows.reduce((s, r) => s + r.valueEur, 0) * 100);
  const total = cash + invested;

  // Evolución: saldo de cuentas al cierre de mes + valor de la cartera ese día
  const accountsByMonth = new Map((accountHistory.data ?? []).map((r) => [r.month, r.net_worth_cents]));
  const portfolioByMonth = monthEndValues(pf.series);
  const firstMonth = [
    pf.series[0]?.date.slice(0, 7),
    accountHistory.data?.find((r) => r.net_worth_cents !== 0)?.month.slice(0, 7),
  ]
    .filter(Boolean)
    .sort()[0];
  const months = monthsBetween(p.windowStart, p.monthStart).filter((m) => !firstMonth || m.slice(0, 7) >= firstMonth);
  const history = [
    ...months.map((m) => ({
      month: m,
      cents: (accountsByMonth.get(m) ?? 0) + Math.round((portfolioByMonth.get(m) ?? 0) * 100),
    })),
    { month: p.monthStart, cents: total },
  ];
  const prevMonth = history.at(-2)?.cents;

  const byKind = (kind: string) =>
    Math.round(rows.filter((r) => r.kind === kind).reduce((s, r) => s + r.valueEur, 0) * 100) / 100;

  return (
    <>
      <section aria-label="Patrimonio" className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-tile bg-finance text-ink p-6 sm:col-span-2">
          <p className="text-sm font-semibold">Patrimonio total</p>
          <p className="font-display mt-3 text-5xl leading-none font-extrabold tracking-tight">{formatCents(total)}</p>
          {prevMonth != null && (
            <p className="mt-3 text-sm font-medium">
              {formatCents(total - prevMonth, "EUR", { signed: true })} desde el cierre del mes pasado
            </p>
          )}
        </div>
        <Link
          href="/finanzas/inversiones"
          className="rounded-tile border-border bg-surface hover:border-border-strong border p-6 transition-colors duration-200"
        >
          <span className="text-muted block text-sm">Inversiones</span>
          <span className="font-display mt-3 block text-3xl font-extrabold tracking-tight">
            {formatCents(invested)}
          </span>
          <span className="text-muted mt-1 block text-sm">{rows.length} posiciones</span>
        </Link>
        <Link
          href="/finanzas/cuentas"
          className="rounded-tile border-border bg-surface hover:border-border-strong border p-6 transition-colors duration-200"
        >
          <span className="text-muted block text-sm">Liquidez</span>
          <span className="font-display mt-3 block text-3xl font-extrabold tracking-tight">{formatCents(cash)}</span>
          <span className="text-muted mt-1 block text-sm">{accounts.filter((a) => !a.archived).length} cuentas</span>
        </Link>
      </section>

      <div className="grid gap-3.5 lg:grid-cols-5">
        <Tile className="lg:col-span-3">
          <TileTitle>Evolución del patrimonio</TileTitle>
          <div className="mt-5">
            {history.length > 1 ? (
              <NetWorthChart data={history} currency="EUR" />
            ) : (
              <EmptyState>La evolución aparecerá cuando haya más de un mes de datos.</EmptyState>
            )}
          </div>
        </Tile>
        <Tile className="lg:col-span-2">
          <TileTitle>Reparto</TileTitle>
          <div className="mt-4">
            <AllocationBar
              parts={[
                { label: "Liquidez", value: cash / 100, className: "bg-content" },
                { label: "Fondos", value: byKind("fund") + byKind("etf"), className: "bg-finance" },
                { label: "Acciones", value: byKind("stock"), className: "bg-nutrition" },
                { label: "Planes y otros", value: byKind("pension") + byKind("other"), className: "bg-attention" },
              ]}
            />
          </div>
          <ul className="mt-6 flex flex-col gap-2">
            {accounts
              .filter((a) => !a.archived)
              .map((a) => (
                <li
                  key={a.id}
                  className="bg-surface-2 rounded-inner flex items-center justify-between gap-3 px-4 py-3 text-sm"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{a.name}</span>
                    <span className="text-muted block text-xs">{ACCOUNT_TYPE_LABELS[a.type]}</span>
                  </span>
                  <span className="font-semibold tabular-nums">{formatCents(a.balance_cents, a.currency)}</span>
                </li>
              ))}
          </ul>
        </Tile>
      </div>
    </>
  );
}
