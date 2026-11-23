import type { Metadata } from "next";
import { clsx } from "clsx";
import { DailyPnlChart } from "@/components/investments/charts";
import { MonthlyReturns } from "@/components/investments/monthly-returns";
import { EmptyState, Tile, TileTitle } from "@/components/ui";
import { BENCHMARK, benchmarkCloses } from "@/lib/investments/benchmark";
import { computePositions, PERIOD_LABELS, PERIODS } from "@/lib/investments/engine";
import { benchmarkReturnsFrom } from "@/lib/investments/history";
import { getPortfolio } from "@/lib/investments/server";
import { monthlyReturns, recentDailyPnl, yearlyStats } from "@/lib/investments/view";
import { formatCents } from "@/lib/finance/money";
import { trendClass } from "@/lib/trend";

export const metadata: Metadata = { title: "Rentabilidad · Inversiones" };

const eur = (v: number, signed = false) => formatCents(Math.round(v * 100), "EUR", { signed });
const pct = (v: number | null) =>
  v == null
    ? "—"
    : `${v > 0 ? "+" : ""}${(v * 100).toLocaleString("es-ES", { maximumFractionDigits: 2, minimumFractionDigits: 2 })} %`;

export default async function ReturnsPage() {
  const pf = await getPortfolio();
  if (pf.series.length === 0) {
    return (
      <Tile>
        <EmptyState>La rentabilidad aparece cuando apuntes tu primera compra.</EmptyState>
      </Tile>
    );
  }
  const total = pf.returns.find((r) => r.period === "TOTAL")!;
  const days = (Date.parse(`${pf.today}T00:00:00Z`) - Date.parse(`${pf.series[0].date}T00:00:00Z`)) / 86_400_000 + 1;
  // Anualizada solo con más de un año de historia (antes exagera)
  const annualized = total.returnPct != null && days >= 365 ? (1 + total.returnPct) ** (365 / days) - 1 : null;
  const bench = benchmarkReturnsFrom(await benchmarkCloses(pf.today), PERIODS, pf.today, pf.series[0].date);
  const years = yearlyStats(pf.input, pf.series, (upTo) => computePositions(pf.input, upTo));

  return (
    <>
      <Tile>
        <TileTitle>Por periodos</TileTitle>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm tabular-nums">
            <thead>
              <tr className="text-muted text-xs">
                <th scope="col" className="py-2 text-left font-medium">
                  Periodo
                </th>
                <th scope="col" className="py-2 text-right font-medium">
                  Rentabilidad
                </th>
                <th scope="col" className="py-2 text-right font-medium">
                  Ganancia
                </th>
                <th scope="col" className="py-2 text-right font-medium">
                  {BENCHMARK.name}
                </th>
              </tr>
            </thead>
            <tbody>
              {pf.returns.map((r) => (
                <tr key={r.period} className="border-border border-t">
                  <th scope="row" className="py-2.5 text-left font-medium">
                    {PERIOD_LABELS[r.period]}
                    {r.sinceInception && r.period !== "TOTAL" && (
                      <span className="text-muted ml-2 text-xs font-normal">desde el inicio</span>
                    )}
                  </th>
                  <td className={clsx("py-2.5 text-right font-semibold", trendClass(r.returnPct))}>
                    {pct(r.returnPct)}
                  </td>
                  <td className="text-muted py-2.5 text-right">{eur(r.pnlEur, true)}</td>
                  <td className={clsx("py-2.5 text-right", trendClass(bench.get(r.period)))}>
                    {pct(bench.get(r.period) ?? null)}
                  </td>
                </tr>
              ))}
              <tr className="border-border border-t">
                <th scope="row" className="py-2.5 text-left font-medium">
                  Anualizada
                </th>
                <td className={clsx("py-2.5 text-right font-semibold", trendClass(annualized))}>{pct(annualized)}</td>
                <td className="text-muted py-2.5 text-right text-xs">
                  {annualized == null ? "con más de un año de historia" : "media por año desde el inicio"}
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-muted mt-3 text-xs">
          Rentabilidad ponderada por tiempo: no la cambian las aportaciones ni las retiradas. {BENCHMARK.name}: ETF
          iShares Core MSCI World en euros ({BENCHMARK.symbol}), solo variación de precio.
        </p>
      </Tile>

      <Tile>
        <TileTitle>Por meses</TileTitle>
        <div className="mt-4">
          <MonthlyReturns months={monthlyReturns(pf.series)} />
        </div>
      </Tile>

      <div className="grid gap-3.5 lg:grid-cols-5">
        <Tile className="lg:col-span-3">
          <TileTitle>Por años</TileTitle>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm tabular-nums">
              <thead>
                <tr className="text-muted text-xs">
                  <th scope="col" className="py-2 text-left font-medium">
                    Año
                  </th>
                  <th scope="col" className="py-2 text-right font-medium">
                    Rentabilidad
                  </th>
                  <th scope="col" className="py-2 text-right font-medium">
                    Ganancia
                  </th>
                  <th scope="col" className="py-2 text-right font-medium">
                    Aportado
                  </th>
                  <th scope="col" className="py-2 text-right font-medium">
                    Plusvalías realizadas
                  </th>
                  <th scope="col" className="py-2 text-right font-medium">
                    Dividendos
                  </th>
                </tr>
              </thead>
              <tbody>
                {years.map((y) => (
                  <tr key={y.year} className="border-border border-t">
                    <th scope="row" className="py-2.5 text-left font-medium">
                      {y.year}
                    </th>
                    <td className={clsx("py-2.5 text-right font-semibold", trendClass(y.returnPct))}>
                      {pct(y.returnPct)}
                    </td>
                    <td className="py-2.5 text-right">{eur(y.pnlEur, true)}</td>
                    <td className="text-muted py-2.5 text-right">{eur(y.contributedEur, true)}</td>
                    <td className={clsx("py-2.5 text-right", trendClass(y.realizedEur))}>{eur(y.realizedEur, true)}</td>
                    <td className="text-muted py-2.5 text-right">{eur(y.dividendsEur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-muted mt-3 text-xs">
            Plusvalías realizadas con FIFO (como Hacienda). Los traspasos entre fondos cuentan aquí como venta, aunque
            fiscalmente no tributan.
          </p>
        </Tile>
        <Tile className="lg:col-span-2">
          <TileTitle>Ganancia o pérdida diaria</TileTitle>
          <p className="text-muted mt-1 text-sm">Últimos 30 días con movimiento</p>
          <div className="mt-5">
            <DailyPnlChart points={recentDailyPnl(pf.series)} />
          </div>
        </Tile>
      </div>
    </>
  );
}
