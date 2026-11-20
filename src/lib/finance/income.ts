// Salario frente a gastos y resultado de las casas de apuestas (cálculos puros)

export interface Movement {
  booked_on: string; // YYYY-MM-DD
  amount_cents: number;
}

const monthOf = (d: string) => d.slice(0, 7);

/** Suma por mes (YYYY-MM) de los movimientos dados. */
export function sumByMonth(rows: Movement[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of rows) out.set(monthOf(r.booked_on), (out.get(monthOf(r.booked_on)) ?? 0) + r.amount_cents);
  return out;
}

export interface MonthSalary {
  cents: number;
  /** "detected": sale de las nóminas del mes; "fallback": el salario apuntado en Ajustes; "none": sin dato. */
  source: "detected" | "fallback" | "none";
}

/** Salario de un mes: las nóminas detectadas; si no hay y es el mes en curso, el salario de respaldo. */
export function salaryFor(
  month: string,
  detected: Map<string, number>,
  fallbackCents: number | null,
  currentMonth: string,
): MonthSalary {
  const cents = detected.get(month) ?? 0;
  if (cents > 0) return { cents, source: "detected" };
  if (month === currentMonth && fallbackCents) return { cents: fallbackCents, source: "fallback" };
  return { cents: 0, source: "none" };
}

export interface BettingPeriod {
  /** YYYY-MM o YYYY */
  key: string;
  depositedCents: number;
  withdrawnCents: number;
  /** Retirado − ingresado (positivo: has sacado más de lo que metiste). */
  netCents: number;
}

/** Ingresos a casas de apuestas (negativos en el banco) y retiradas (positivos), por mes o por año. */
export function bettingByPeriod(rows: Movement[], by: "month" | "year"): BettingPeriod[] {
  const map = new Map<string, BettingPeriod>();
  for (const r of rows) {
    const key = by === "month" ? monthOf(r.booked_on) : r.booked_on.slice(0, 4);
    const p = map.get(key) ?? { key, depositedCents: 0, withdrawnCents: 0, netCents: 0 };
    if (r.amount_cents < 0) p.depositedCents -= r.amount_cents;
    else p.withdrawnCents += r.amount_cents;
    p.netCents += r.amount_cents;
    map.set(key, p);
  }
  return [...map.values()].sort((a, b) => b.key.localeCompare(a.key));
}

/** Resultado total: lo retirado − lo ingresado + lo que queda en las casas de apuestas. */
export function bettingResult(rows: Movement[], balancesCents: number): number {
  return rows.reduce((s, r) => s + r.amount_cents, 0) + balancesCents;
}
