import { addDays, periodStart, valueAt, type Period } from "./engine";

export const HISTORY_RANGES = ["1D", "1S", "1M", "YTD", "1A", "3A", "5A"] as const;
export type HistoryRange = (typeof HISTORY_RANGES)[number];

export const parseHistoryRange = (v: string | null): HistoryRange =>
  (HISTORY_RANGES as readonly string[]).includes(v ?? "") ? (v as HistoryRange) : "1A";

/** Desde qué día pedir cierres: el día anterior al periodo (para tener el precio de partida). */
export function historyFrom(range: HistoryRange, today: string): string {
  // 1D: cierres diarios, así que «hoy» es el último cierre frente al anterior (con margen por fines de semana)
  if (range === "1D") return addDays(today, -7);
  return addDays(periodStart(range, today)!, -6);
}

export interface HistoryResult {
  points: { date: string; value: number }[];
  changePct: number | null;
}

/** Recorta la serie al periodo (con el último cierre anterior como punto de partida) y calcula la variación. */
export function historyWindow(
  points: { date: string; value: number }[],
  range: HistoryRange,
  today: string,
): HistoryResult {
  if (points.length === 0) return { points: [], changePct: null };
  let window: typeof points;
  if (range === "1D") window = points.slice(-2);
  else {
    const start = periodStart(range, today)!;
    const firstIn = points.findIndex((p) => p.date > start);
    window = firstIn === -1 ? points.slice(-1) : points.slice(Math.max(0, firstIn - 1));
  }
  const first = window[0];
  const last = window.at(-1)!;
  return {
    points: window,
    changePct: window.length >= 2 && first.value > 0 ? last.value / first.value - 1 : null,
  };
}

/** Variación del índice en cada periodo (null si no hay datos o si la fuente falla). */
export function benchmarkReturnsFrom(
  points: { date: string; value: number }[],
  periods: readonly Period[],
  today: string,
  firstDate: string | null,
): Map<Period, number | null> {
  const out = new Map<Period, number | null>();
  const last = points.at(-1);
  for (const period of periods) {
    // «Desde el inicio» se compara desde la primera operación de la cartera
    const start = period === "TOTAL" ? (firstDate ? addDays(firstDate, -1) : null) : periodStart(period, today);
    // Sin histórico suficiente para el periodo, no se compara
    const base = start && points.length && start >= points[0].date ? valueAt(points, start) : null;
    out.set(period, last && base ? last.value / base - 1 : null);
  }
  return out;
}
