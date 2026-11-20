import type { Metadata } from "next";
import Link from "next/link";
import { NetWorthChart } from "@/components/finance/charts";
import { AllocationBar } from "@/components/investments/charts";
import { PriceRefresher } from "@/components/investments/price-refresher";
import { buttonClass, EmptyState, Tile, TileTitle } from "@/components/ui";
import { ACCOUNT_TYPE_LABELS } from "@/lib/finance/accounts";
import { formatCents } from "@/lib/finance/money";
import { freshness } from "@/lib/finance/freshness";
import { saveSnapshot } from "@/lib/finance/net-worth";
import { financePeriods, monthsBetween } from "@/lib/finance/periods";
import { getAccounts } from "@/lib/finance/server";
import { getPortfolio } from "@/lib/investments/server";
import { monthEndValues, positionRows } from "@/lib/investments/view";
import { createClient } from "@/lib/supabase/server";
import { clsx } from "clsx";

export const metadata: Metadata = { title: "Patrimonio · Finanzas" };

export default async function NetWorthPage({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  const daily = (await searchParams).vista === "dias";
  const p = financePeriods(new Date(), 24);
  const supabase = await createClient();
  const [accounts, pf, accountHistory, snapshots, lastMoves] = await Promise.all([
    getAccounts(),
    getPortfolio(),
    supabase.rpc("net_worth_by_month", { p_from: p.windowStart, p_to: p.monthStart }),
    supabase.from("net_worth_snapshots").select("day, total_cents").order("day", { ascending: false }).limit(120),
    supabase.rpc("account_last_movements"),
  ]);

  if (accounts.length === 0 && pf.operations.length === 0) {
    return (
      <Tile>
        <EmptyState>Crea tus cuentas e importa tu cartera para ver tu patrimonio.</EmptyState>
        <div className="flex justify-center gap-2">
          <Link href="/ajustes/finanzas/cuentas" className={buttonClass.secondary}>
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
  // Foto de hoy (la tarea diaria también la guarda aunque no abras la app)
  await saveSnapshot(supabase, { cashCents: cash, investmentsCents: invested, totalCents: total }, pf.today);
  const days = [...(snapshots.data ?? [])].reverse().map((r) => ({ month: r.day, cents: r.total_cents ?? 0 }));
  if (days.at(-1)?.month !== pf.today) days.push({ month: pf.today, cents: total });

  // De cuándo son los datos de cada fuente
  const lastMove = new Map((lastMoves.data ?? []).map((r) => [r.account_id, r.last_booked_on]));
  const prices = freshness(pf.lastPriceDate, pf.today);
  const activeAccounts = accounts.filter((a) => !a.archived);
  const staleAccounts = activeAccounts
    .map((a) => ({ a, f: freshness(lastMove.get(a.id) ?? null, pf.today) }))
    .filter((x) => x.f.stale);

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
      {((pf.operations.length > 0 && prices.stale) || staleAccounts.length > 0) && (
        <section aria-label="Datos viejos" className="border-attention rounded-tile flex flex-col gap-2 border p-4">
          <p className="text-attention text-sm font-semibold">! Hay cifras con datos de hace más de 3 días</p>
          {pf.operations.length > 0 && prices.stale && (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="min-w-0 flex-1">Precios de las inversiones: {prices.label}.</span>
              <PriceRefresher stale={false} />
            </div>
          )}
          {staleAccounts.map(({ a, f }) => (
            <div key={a.id} className="flex flex-wrap items-center gap-3 text-sm">
              <span className="min-w-0 flex-1">
                {a.name}: último movimiento {f.label === "sin datos" ? "— ninguno todavía" : f.label}.
              </span>
              <Link href="/finanzas/importar" className={buttonClass.secondary}>
                Importar extracto
              </Link>
            </div>
          ))}
        </section>
      )}
      <section aria-label="Patrimonio" className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-tile bg-surface border-border border p-6 sm:col-span-2">
          <p className="text-sm font-semibold">Patrimonio total</p>
          <p className="font-display mt-3 text-5xl leading-none font-extrabold">{formatCents(total)}</p>
          {prevMonth != null && (
            <p className="mt-3 text-sm font-medium">
              {formatCents(total - prevMonth, "EUR", { signed: true })} desde el cierre del mes pasado
            </p>
          )}
        </div>
        <Link
          href="/finanzas/inversiones"
          className="rounded-tile border-border bg-surface hover:border-border-strong border p-6 transition-[border-color,transform] duration-150 active:scale-[0.98] motion-reduce:active:scale-100"
        >
          <span className="text-muted block text-sm">Inversiones</span>
          <span className="font-display mt-3 block text-3xl font-extrabold">{formatCents(invested)}</span>
          <span className="text-muted mt-1 block text-sm">{rows.length} posiciones</span>
          <span className={clsx("mt-1 block text-xs", prices.stale ? "text-attention" : "text-muted")}>
            {prices.stale ? "! " : ""}Precios {prices.label}
          </span>
        </Link>
        <Link
          href="/ajustes/finanzas/cuentas"
          className="rounded-tile border-border bg-surface hover:border-border-strong border p-6 transition-[border-color,transform] duration-150 active:scale-[0.98] motion-reduce:active:scale-100"
        >
          <span className="text-muted block text-sm">Liquidez</span>
          <span className="font-display mt-3 block text-3xl font-extrabold">{formatCents(cash)}</span>
          <span className="text-muted mt-1 block text-sm">{activeAccounts.length} cuentas</span>
          <span className={clsx("mt-1 block text-xs", staleAccounts.length ? "text-attention" : "text-muted")}>
            {staleAccounts.length ? `! ${staleAccounts.length} sin movimientos recientes` : "Movimientos al día"}
          </span>
        </Link>
      </section>

      <div className="grid gap-3.5 lg:grid-cols-5">
        <Tile className="lg:col-span-3">
          <div className="flex flex-wrap items-center gap-3">
            <TileTitle>Evolución del patrimonio</TileTitle>
            <nav aria-label="Vista" className="bg-surface-2 ml-auto flex rounded-full p-1">
              {[
                ["Meses", "/finanzas", !daily],
                ["Días", "/finanzas?vista=dias", daily],
              ].map(([label, href, active]) => (
                <Link
                  key={String(label)}
                  href={String(href)}
                  aria-current={active ? "page" : undefined}
                  className={clsx(
                    "rounded-full px-3 py-1 text-xs font-medium",
                    active ? "bg-selected text-on-selected" : "text-muted hover:text-text",
                  )}
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="mt-5">
            {daily ? (
              days.length > 1 ? (
                <NetWorthChart data={days} currency="EUR" daily />
              ) : (
                <EmptyState>Cada día se guarda una foto del patrimonio: mañana verás el primer tramo.</EmptyState>
              )
            ) : history.length > 1 ? (
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
            {activeAccounts.map((a) => (
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
