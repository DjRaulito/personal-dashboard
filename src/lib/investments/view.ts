import { addDays, periodStart, valueAt, type DailyPoint, type EngineInput, type Period, type Position } from "./engine";
import type { AssetKind } from "./types";

export const KIND_LABELS: Record<AssetKind, string> = {
  fund: "Fondos",
  stock: "Acciones",
  etf: "ETF",
  pension: "Planes de pensiones",
  other: "Otros",
};

export const CHART_RANGES = ["1M", "3M", "YTD", "1A", "TOTAL"] as const;
export type ChartRange = (typeof CHART_RANGES)[number];

export function parseRange(v: string | undefined): ChartRange {
  return (CHART_RANGES as readonly string[]).includes(v ?? "") ? (v as ChartRange) : "1A";
}

/** Puntos de la gráfica de valor para un rango. */
export function chartPoints(series: DailyPoint[], range: ChartRange, today: string) {
  const start = periodStart(range as Period, today);
  return series
    .filter((p) => !start || p.date > start)
    .map((p) => ({ date: p.date, value: p.valueEur, invested: p.investedEur }));
}

/** Últimos N días con movimiento de mercado (sin fines de semana a cero). */
export function recentDailyPnl(series: DailyPoint[], days = 30) {
  return series
    .filter((p) => Math.abs(p.pnlEur) > 0.005 || p.flowEur !== 0)
    .slice(-days)
    .map((p) => ({ date: p.date, pnl: p.pnlEur }));
}

export interface PositionRow extends Position {
  name: string;
  kind: AssetKind;
  currency: string;
  dayChangeEur: number;
  dayChangePct: number | null;
  weight: number;
}

/** Variación del último día con precio respecto al anterior, por posición. */
export function positionRows(
  input: EngineInput,
  positions: Map<string, Position>,
  assets: { id: string; name: string; kind: AssetKind; currency: string }[],
): PositionRow[] {
  const open = assets
    .map((a) => ({ a, p: positions.get(a.id) }))
    .filter((x): x is { a: (typeof assets)[number]; p: Position } => !!x.p && x.p.quantity > 0);
  const total = open.reduce((s, x) => s + x.p.valueEur, 0);
  return open
    .map(({ a, p }) => {
      const series = input.prices.get(a.id) ?? [];
      const last = series.at(-1);
      const prevPrice = last ? valueAt(series, addDays(last.date, -1)) : null;
      const pct = last && prevPrice && last.date > series[0].date ? last.value / prevPrice - 1 : null;
      return {
        ...p,
        name: a.name,
        kind: a.kind,
        currency: a.currency,
        dayChangePct: pct,
        dayChangeEur: pct != null ? (p.valueEur * pct) / (1 + pct) : 0,
        weight: total ? p.valueEur / total : 0,
      };
    })
    .sort((x, y) => y.valueEur - x.valueEur);
}

/** Valor de la cartera al cierre de cada mes (YYYY-MM-01 -> valor del último día del mes). */
export function monthEndValues(series: DailyPoint[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const p of series) out.set(`${p.date.slice(0, 7)}-01`, p.valueEur);
  return out;
}

export interface YearStats {
  year: number;
  returnPct: number | null;
  pnlEur: number;
  contributedEur: number;
  realizedEur: number;
  dividendsEur: number;
}

/** Rentabilidad, aportaciones, plusvalías realizadas y dividendos por año natural. */
export function yearlyStats(
  input: EngineInput,
  series: DailyPoint[],
  compute: (upTo: string) => Map<string, Position>,
): YearStats[] {
  if (series.length === 0) return [];
  const first = Number(series[0].date.slice(0, 4));
  const last = Number(series.at(-1)!.date.slice(0, 4));
  const totals = (upTo: string) => {
    let realized = 0;
    let dividends = 0;
    for (const p of compute(upTo).values()) {
      realized += p.realizedEur;
      dividends += p.dividendsEur;
    }
    return { realized, dividends };
  };
  const out: YearStats[] = [];
  let prev = { realized: 0, dividends: 0 };
  for (let y = first; y <= last; y++) {
    const days = series.filter((p) => p.date.startsWith(`${y}-`));
    const end = totals(`${y}-12-31`);
    out.push({
      year: y,
      returnPct: days.length ? days.reduce((a, p) => a * (1 + p.returnPct), 1) - 1 : null,
      pnlEur: days.reduce((s, p) => s + p.pnlEur, 0),
      contributedEur: days.reduce((s, p) => s + p.flowEur, 0),
      realizedEur: end.realized - prev.realized,
      dividendsEur: end.dividends - prev.dividends,
    });
    prev = end;
  }
  void input;
  return out.reverse();
}
