import type { Metadata } from "next";
import Link from "next/link";
import { clsx } from "clsx";
import { AllocationBar, DailyPnlChart, ValueChart } from "@/components/investments/charts";
import { PriceRefresher } from "@/components/investments/price-refresher";
import { buttonClass, EmptyState, Tile, TileTitle } from "@/components/ui";
import { PERIOD_LABELS } from "@/lib/investments/engine";
import { getPortfolio } from "@/lib/investments/server";
import {
  CHART_RANGES,
  chartPoints,
  KIND_LABELS,
  parseRange,
  positionRows,
  recentDailyPnl,
} from "@/lib/investments/view";
import { formatCents } from "@/lib/finance/money";

export const metadata: Metadata = { title: "Inversiones · Finanzas" };

const eur = (v: number, signed = false) => formatCents(Math.round(v * 100), "EUR", { signed });
const pct = (v: number | null) =>
  v == null
    ? "—"
    : `${v > 0 ? "+" : ""}${(v * 100).toLocaleString("es-ES", { maximumFractionDigits: 2, minimumFractionDigits: 2 })} %`;
const tone = (v: number | null) =>
  v == null || Math.abs(v) < 1e-9 ? "text-muted" : v > 0 ? "text-finance" : "text-expense";

const RANGE_LABELS = { "1M": "1M", "3M": "3M", YTD: "Año", "1A": "1A", TOTAL: "Todo" } as const;

export default async function InvestmentsPage({ searchParams }: { searchParams: Promise<{ rango?: string }> }) {
  const range = parseRange((await searchParams).rango);
  const pf = await getPortfolio();

  if (pf.operations.length === 0) {
    return (
      <Tile>
        <EmptyState>
          Aún no hay inversiones. Importa tu cartera de Investing y las operaciones de tus brokers.
        </EmptyState>
        <div className="flex justify-center">
          <Link href="/finanzas/inversiones/importar" className={buttonClass.primary}>
            Importar cartera
          </Link>
        </div>
      </Tile>
    );
  }

  const rows = positionRows(pf.input, pf.positions, pf.assets);
  const value = rows.reduce((s, r) => s + r.valueEur, 0);
  const cost = rows.reduce((s, r) => s + r.costEur, 0);
  const all = [...pf.positions.values()];
  const realized = all.reduce((s, p) => s + p.realizedEur, 0);
  const dividends = all.reduce((s, p) => s + p.dividendsEur - p.feesEur, 0);
  const today = pf.returns.find((r) => r.period === "1D")!;
  const total = pf.returns.find((r) => r.period === "TOTAL")!;
  const byKind = new Map<string, number>();
  for (const r of rows) byKind.set(r.kind, (byKind.get(r.kind) ?? 0) + r.valueEur);
  const kindColors: Record<string, string> = {
    fund: "bg-finance",
    stock: "bg-content",
    etf: "bg-nutrition",
    pension: "bg-attention",
    other: "bg-gym",
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <PriceRefresher stale={!pf.lastPriceDate || pf.lastPriceDate < pf.today} />
        <div className="ml-auto flex flex-wrap gap-2">
          <Link href="/finanzas/inversiones/operaciones" className={buttonClass.secondary}>
            Operaciones
          </Link>
          <Link href="/finanzas/inversiones/importar" className={buttonClass.secondary}>
            Importar
          </Link>
          <a href="/api/investments/export" className={buttonClass.secondary}>
            Exportar a Investing
          </a>
        </div>
      </div>

      <section aria-label="Resumen" className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-tile bg-finance text-ink p-6 sm:col-span-2">
          <p className="text-sm font-semibold">Valor de la cartera</p>
          <p className="font-display mt-3 text-5xl leading-none font-extrabold tracking-tight">{eur(value)}</p>
          <p className="mt-3 text-sm font-medium">
            Hoy {eur(today.pnlEur, true)} ({pct(today.returnPct)})
          </p>
        </div>
        <Tile>
          <p className="text-muted text-sm">Plusvalía latente</p>
          <p className={clsx("font-display mt-3 text-3xl font-extrabold tracking-tight", tone(value - cost))}>
            {eur(value - cost, true)}
          </p>
          <p className="text-muted mt-1 text-sm">Coste {eur(cost)}</p>
        </Tile>
        <Tile>
          <p className="text-muted text-sm">Ganancia total</p>
          <p className={clsx("font-display mt-3 text-3xl font-extrabold tracking-tight", tone(total.pnlEur))}>
            {eur(total.pnlEur, true)}
          </p>
          <p className="text-muted mt-1 text-sm">
            Realizada {eur(realized, true)} · Dividendos {eur(dividends)}
          </p>
        </Tile>
      </section>

      <Tile>
        <TileTitle>Rentabilidad</TileTitle>
        <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-9">
          {pf.returns.map((r) => (
            <li key={r.period} className="bg-surface-2 rounded-inner px-2.5 py-3">
              <p className="text-muted text-xs">{PERIOD_LABELS[r.period]}</p>
              <p className={clsx("mt-1 text-base font-semibold whitespace-nowrap tabular-nums", tone(r.returnPct))}>
                {pct(r.returnPct)}
              </p>
              <p className="text-muted text-xs tabular-nums">{eur(r.pnlEur, true)}</p>
              {r.sinceInception && r.period !== "TOTAL" && <p className="text-muted text-[10px]">desde el inicio</p>}
            </li>
          ))}
        </ul>
        <p className="text-muted mt-3 text-xs">
          Rentabilidad ponderada por tiempo: no la cambian las aportaciones ni las retiradas.
        </p>
      </Tile>

      <div className="grid gap-3.5 lg:grid-cols-5">
        <Tile className="lg:col-span-3">
          <div className="flex flex-wrap items-center gap-3">
            <TileTitle>Evolución</TileTitle>
            <nav aria-label="Rango" className="bg-surface-2 ml-auto flex rounded-full p-1">
              {CHART_RANGES.map((r) => (
                <Link
                  key={r}
                  href={r === "1A" ? "/finanzas/inversiones" : `/finanzas/inversiones?rango=${r}`}
                  aria-current={r === range ? "page" : undefined}
                  className={clsx(
                    "rounded-full px-3 py-1 text-xs font-medium",
                    r === range ? "bg-finance text-ink" : "text-muted hover:text-text",
                  )}
                >
                  {RANGE_LABELS[r]}
                </Link>
              ))}
            </nav>
          </div>
          <div className="mt-5">
            <ValueChart points={chartPoints(pf.series, range, pf.today)} />
          </div>
        </Tile>
        <Tile className="lg:col-span-2">
          <TileTitle>Ganancia o pérdida diaria</TileTitle>
          <p className="text-muted mt-1 text-sm">Últimos 30 días con movimiento</p>
          <div className="mt-5">
            <DailyPnlChart points={recentDailyPnl(pf.series)} />
          </div>
        </Tile>
      </div>

      <Tile>
        <TileTitle>Reparto</TileTitle>
        <div className="mt-4">
          <AllocationBar
            parts={[...byKind.entries()].map(([kind, v]) => ({
              label: KIND_LABELS[kind as keyof typeof KIND_LABELS],
              value: v,
              className: kindColors[kind] ?? "bg-gym",
            }))}
          />
        </div>
      </Tile>

      <Tile>
        <TileTitle>Posiciones ({rows.length})</TileTitle>
        <div className="relative mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="text-muted text-left">
              <tr>
                <th className="py-2 font-medium">Activo</th>
                <th className="py-2 text-right font-medium">Valor</th>
                <th className="py-2 text-right font-medium">Peso</th>
                <th className="py-2 text-right font-medium">Hoy</th>
                <th className="py-2 text-right font-medium">Coste</th>
                <th className="py-2 text-right font-medium">Plusvalía</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const gain = r.valueEur - r.costEur;
                return (
                  <tr key={r.assetId} className="border-border border-t">
                    <td className="max-w-xs py-2.5">
                      <Link
                        href={`/finanzas/inversiones/activo/${r.assetId}`}
                        className="block truncate font-medium hover:underline"
                      >
                        {r.name}
                      </Link>
                      <span className="text-muted text-xs tabular-nums">
                        {r.quantity.toLocaleString("es-ES", { maximumFractionDigits: 4 })} ×{" "}
                        {r.lastPrice?.toLocaleString("es-ES", { maximumFractionDigits: 4 }) ?? "—"} {r.currency}
                      </span>
                    </td>
                    <td className="py-2.5 text-right font-semibold tabular-nums">{eur(r.valueEur)}</td>
                    <td className="text-muted py-2.5 text-right tabular-nums">{(r.weight * 100).toFixed(1)} %</td>
                    <td className={clsx("py-2.5 text-right tabular-nums", tone(r.dayChangePct))}>
                      {pct(r.dayChangePct)}
                    </td>
                    <td className="text-muted py-2.5 text-right tabular-nums">{eur(r.costEur)}</td>
                    <td className={clsx("py-2.5 text-right tabular-nums", tone(gain))}>
                      {eur(gain, true)}
                      <span className="block text-xs">{r.costEur ? pct(gain / r.costEur) : "—"}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Tile>
    </>
  );
}
