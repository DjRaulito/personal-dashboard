// Rejilla mensual del calendario editorial (semanas de lunes a domingo).

export interface MonthRef {
  year: number;
  month: number; // 1-12
}

/** Lee «2026-11» o devuelve el mes de `fallback`. */
export function parseMonth(raw: string | undefined, fallback: MonthRef): MonthRef {
  const m = raw?.match(/^(\d{4})-(\d{2})$/);
  if (!m) return fallback;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (year < 2000 || year > 2100 || month < 1 || month > 12) return fallback;
  return { year, month };
}

export function shiftMonth({ year, month }: MonthRef, delta: number): MonthRef {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export const monthKey = ({ year, month }: MonthRef) => `${year}-${String(month).padStart(2, "0")}`;

export interface GridDay {
  key: string; // YYYY-MM-DD
  day: number;
  inMonth: boolean;
}

/** Semanas completas (lunes a domingo) que cubren el mes. */
export function monthGrid({ year, month }: MonthRef): GridDay[][] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7; // lunes = 0
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const total = Math.ceil((offset + daysInMonth) / 7) * 7;
  const weeks: GridDay[][] = [];
  for (let i = 0; i < total; i++) {
    const d = new Date(Date.UTC(year, month - 1, 1 - offset + i));
    const key = d.toISOString().slice(0, 10);
    if (i % 7 === 0) weeks.push([]);
    weeks.at(-1)!.push({ key, day: d.getUTCDate(), inMonth: d.getUTCMonth() === month - 1 });
  }
  return weeks;
}
