import type { Metadata } from "next";
import Link from "next/link";
import { clsx } from "clsx";
import { ValueChart } from "@/components/investments/charts";
import { PriceRefresher } from "@/components/investments/price-refresher";
import { WeightsList } from "@/components/investments/weights";
import { buttonClass, EmptyState, Tile, TileTitle } from "@/components/ui";
import { BENCHMARK, benchmarkCloses } from "@/lib/investments/benchmark";
import { benchmarkReturnsFrom } from "@/lib/investments/history";
import { getPortfolio } from "@/lib/investments/server";
import { CHART_RANGES, chartPoints, parseRange, positionRows, RANGE_LABELS } from "@/lib/investments/view";
import { formatCents } from "@/lib/finance/money";
import { trendClass } from "@/lib/trend";

export const metadata: Metadata = { title: "Inversiones" };

const eur = (v: number, signed = false) => formatCents(Math.round(v * 100), "EUR", { signed });
const pct = (v: number | null) =>
  v == null
    ? "—"
    : `${v > 0 ? "+" : ""}${(v * 100).toLocaleString("es-ES", { maximumFractionDigits: 2, minimumFractionDigits: 2 })} %`;

/** Resumen: valor y su evolución, plusvalía, ganancia total, rentabilidad del año y pesos de toda la cartera. */
export default async function InvestmentsSummaryPage({ searchParams }: { searchParams: Promise<{ rango?: string }> }) {
  const range = parseRange((await searchParams).rango);
  const pf = await getPortfolio();

  if (pf.operations.length === 0) {
    return (
      <Tile>
        <EmptyState>Aún no hay inversiones. Apunta tu primera compra o importa tu cartera.</EmptyState>
        <div className="flex justify-center gap-2">
          <Link href="/inversiones/posiciones" className={buttonClass.primary}>
            Nueva compra
          </Link>
          <Link href="/inversiones/importar" className={buttonClass.secondary}>
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
  const ret = (p: string) => pf.returns.find((r) => r.period === p)!;
  const today = ret("1D");
  const total = ret("TOTAL");
  const ytd = ret("YTD");
  const open = value - cost;
  const benchYtd = benchmarkReturnsFrom(await benchmarkCloses(pf.today), ["YTD"], pf.today, null).get("YTD") ?? null;

  return (
    <>
      <div className="flex justify-end">
        <PriceRefresher stale={!pf.lastPriceDate || pf.lastPriceDate < pf.today} />
      </div>
      <div className="grid gap-3.5 lg:grid-cols-4">
        <section
          aria-label="Valor de la cartera"
          className="rounded-tile bg-surface border-border border p-6 lg:col-span-2 lg:row-span-2"
        >
          <p className="text-muted text-sm">Valor de la cartera</p>
          <p className="font-display mt-2 text-5xl leading-none font-extrabold tabular-nums">{eur(value)}</p>
          <p className={clsx("mt-2 text-sm font-semibold tabular-nums", trendClass(today.pnlEur))}>
            {eur(today.pnlEur, true)} ({pct(today.returnPct)}) hoy
          </p>
          <div className="mt-5">
            <ValueChart points={chartPoints(pf.series, range, pf.today)} />
          </div>
          <nav aria-label="Rango del gráfico" className="mt-3 flex flex-wrap gap-1">
            {CHART_RANGES.map((r) => (
              <Link
                key={r}
                href={r === "YTD" ? "/inversiones" : `/inversiones?rango=${r}`}
                aria-current={r === range ? "page" : undefined}
                scroll={false}
                className={clsx(
                  "rounded-full px-3 py-1 text-xs font-medium transition-[background-color,transform] duration-150 active:scale-95",
                  r === range ? "bg-selected text-on-selected" : "text-muted hover:text-text",
                )}
              >
                {RANGE_LABELS[r]}
              </Link>
            ))}
          </nav>
        </section>

        <Tile className="flex flex-col items-center justify-center p-5 text-center">
          <p className="text-muted text-sm">Plusvalía abierta</p>
          <p className={clsx("font-display mt-1 text-2xl font-extrabold tabular-nums", trendClass(open))}>
            {eur(open, true)}
          </p>
          <p className="text-muted mt-1 text-xs tabular-nums">
            {cost > 0 ? `${pct(open / cost)} sobre ${eur(cost)} invertidos` : "—"}
          </p>
        </Tile>
        <Tile className="flex flex-col items-center justify-center p-5 text-center">
          <p className="text-muted text-sm">Ganancia total</p>
          <p className={clsx("font-display mt-1 text-2xl font-extrabold tabular-nums", trendClass(total.pnlEur))}>
            {eur(total.pnlEur, true)}
          </p>
          <p className="text-muted mt-1 text-xs tabular-nums">
            Vendidas {eur(realized, true)} · Dividendos {eur(dividends)}
          </p>
        </Tile>
        <Tile className="flex flex-col items-center justify-center text-center lg:col-span-2">
          <p className="text-muted text-sm">Rentabilidad este año (YTD)</p>
          <p className={clsx("font-display mt-1 text-4xl font-extrabold tabular-nums", trendClass(ytd.returnPct))}>
            {pct(ytd.returnPct)}
          </p>
          <p className="text-muted mt-1 text-sm tabular-nums">
            {eur(ytd.pnlEur, true)} desde el 1 de enero
            {benchYtd != null && ` · ${BENCHMARK.name} ${pct(benchYtd)}`} ·{" "}
            <Link href="/inversiones/rentabilidad" className="text-text underline">
              ver por periodos
            </Link>
          </p>
        </Tile>

        <Tile className="lg:col-span-4">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <TileTitle>Pesos de toda la cartera</TileTitle>
            <span className="text-muted text-sm">{rows.length} posiciones abiertas</span>
          </div>
          <div className="mt-5">
            <WeightsList rows={rows} />
          </div>
        </Tile>
      </div>
    </>
  );
}
