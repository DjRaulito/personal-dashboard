import type { Metadata } from "next";
import Link from "next/link";
import { clsx } from "clsx";
import { AllocationBar, DailyPnlChart, ValueChart } from "@/components/investments/charts";
import { PositionsBoard } from "@/components/investments/positions-board";
import { PriceRefresher } from "@/components/investments/price-refresher";
import { buttonClass, EmptyState, Tile, TileTitle } from "@/components/ui";
import type { BoardAsset } from "@/lib/investments/board";
import { operationCashEur, PERIOD_LABELS } from "@/lib/investments/engine";
import { getPortfolio } from "@/lib/investments/server";
import {
  averageCostEur,
  CHART_RANGES,
  chartPoints,
  closedRows,
  KIND_LABELS,
  parseRange,
  positionRows,
  priceOrigin,
  recentDailyPnl,
} from "@/lib/investments/view";
import { formatCents } from "@/lib/finance/money";
import { trendClass } from "@/lib/trend";

export const metadata: Metadata = { title: "Inversiones · Finanzas" };

const eur = (v: number, signed = false) => formatCents(Math.round(v * 100), "EUR", { signed });
const pct = (v: number | null) =>
  v == null
    ? "—"
    : `${v > 0 ? "+" : ""}${(v * 100).toLocaleString("es-ES", { maximumFractionDigits: 2, minimumFractionDigits: 2 })} %`;
const tone = trendClass;

const RANGE_LABELS = { "1M": "1M", "3M": "3M", YTD: "Año", "1A": "1A", TOTAL: "Todo" } as const;

export default async function InvestmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ rango?: string; activo?: string }>;
}) {
  const params = await searchParams;
  const range = parseRange(params.rango);
  const pf = await getPortfolio();

  if (pf.operations.length === 0) {
    return (
      <Tile>
        <EmptyState>
          Aún no hay inversiones. Apunta tu primera compra o importa tu cartera de Investing y tus brokers.
        </EmptyState>
        <div className="flex justify-center">
          <Link href="/finanzas/inversiones/importar" className={buttonClass.secondary}>
            Importar cartera
          </Link>
        </div>
        <PositionsBoard assets={[]} today={pf.today} initialAssetId={null} />
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
  // Datos de la lista de posiciones y de su panel
  const rowById = new Map(rows.map((r) => [r.assetId, r]));
  const closedById = new Map(closedRows(pf.positions, pf.assets, pf.operations).map((r) => [r.assetId, r]));
  const engineAssets = new Map(pf.input.assets.map((a) => [a.id, a]));
  const opsByAsset = new Map<string, BoardAsset["operations"]>();
  for (const op of pf.operations) {
    const list = opsByAsset.get(op.assetId) ?? [];
    list.push({
      id: op.id,
      type: op.type,
      date: op.date,
      quantity: op.quantity,
      price: op.price,
      cashEur: operationCashEur(op, engineAssets.get(op.assetId)!, pf.input.fx),
      isSplit: op.isSplit,
      source: op.source,
      notes: op.notes,
    });
    opsByAsset.set(op.assetId, list);
  }
  const board: BoardAsset[] = pf.assets.map((a) => {
    const p = pf.positions.get(a.id);
    const row = rowById.get(a.id);
    const closed = closedById.get(a.id);
    const lastPriceDate = pf.input.prices.get(a.id)?.at(-1)?.date ?? null;
    return {
      id: a.id,
      name: a.name,
      isin: a.isin,
      kind: a.kind,
      currency: a.currency,
      priceSource: a.price_source,
      priceSymbol: a.price_symbol,
      priceOrigin: priceOrigin(a, lastPriceDate),
      lastPrice: p?.lastPrice ?? null,
      lastPriceDate,
      quantity: p?.quantity ?? 0,
      costEur: p?.costEur ?? 0,
      valueEur: p?.valueEur ?? 0,
      avgCostEur: p ? averageCostEur(p) : null,
      dayChangePct: row?.dayChangePct ?? null,
      realizedEur: p?.realizedEur ?? 0,
      dividendsEur: p?.dividendsEur ?? 0,
      feesEur: p?.feesEur ?? 0,
      weight: row?.weight ?? 0,
      open: Boolean(row),
      resultEur: closed?.resultEur ?? 0,
      closedOn: closed?.closedOn ?? null,
      operations: opsByAsset.get(a.id) ?? [],
    };
  });
  board.sort((x, y) => y.valueEur - x.valueEur);

  const kindColors: Record<string, string> = {
    fund: "bg-finance",
    stock: "bg-content",
    etf: "bg-nutrition",
    pension: "bg-attention",
    other: "bg-extra",
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <PriceRefresher stale={!pf.lastPriceDate || pf.lastPriceDate < pf.today} />
        <details className="relative ml-auto">
          <summary
            className={clsx(buttonClass.secondary, "cursor-pointer list-none [&::-webkit-details-marker]:hidden")}
          >
            Importar / exportar
          </summary>
          <ul className="bg-surface-solid border-border-strong rounded-inner absolute right-0 z-20 mt-1 w-64 overflow-hidden border py-1 shadow-xl">
            <li>
              <Link href="/finanzas/inversiones/importar" className="hover:bg-surface block px-4 py-2.5 text-sm">
                Importar (Investing, MyInvestor, MEXEM)
              </Link>
            </li>
            <li>
              <a href="/api/investments/export" className="hover:bg-surface block px-4 py-2.5 text-sm">
                Exportar a Investing (CSV)
              </a>
            </li>
          </ul>
        </details>
      </div>

      <section aria-label="Resumen" className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-tile bg-surface border-border border p-6 sm:col-span-2">
          <p className="text-sm font-semibold">Valor de la cartera</p>
          <p className="font-display mt-3 text-5xl leading-none font-extrabold">{eur(value)}</p>
          <p className="mt-3 text-sm font-medium">
            Hoy {eur(today.pnlEur, true)} ({pct(today.returnPct)})
          </p>
        </div>
        <Tile>
          <p className="text-muted text-sm">Plusvalía latente</p>
          <p className={clsx("font-display mt-3 text-3xl font-extrabold", tone(value - cost))}>
            {eur(value - cost, true)}
          </p>
          <p className="text-muted mt-1 text-sm">Coste {eur(cost)}</p>
        </Tile>
        <Tile>
          <p className="text-muted text-sm">Ganancia total</p>
          <p className={clsx("font-display mt-3 text-3xl font-extrabold", tone(total.pnlEur))}>
            {eur(total.pnlEur, true)}
          </p>
          <p className="text-muted mt-1 text-sm">
            Realizada {eur(realized, true)} · Dividendos {eur(dividends)}
          </p>
        </Tile>
      </section>

      <PositionsBoard assets={board} today={pf.today} initialAssetId={params.activo ?? null} />

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
                    "rounded-full px-3 py-1 text-xs font-medium transition-[background-color,transform] duration-150 active:scale-95",
                    r === range ? "bg-selected text-on-selected" : "text-muted hover:text-text",
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
              className: kindColors[kind] ?? "bg-extra",
            }))}
          />
        </div>
      </Tile>
    </>
  );
}
