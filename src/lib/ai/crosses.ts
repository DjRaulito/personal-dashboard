// Cruces entre módulos (gimnasio, nutrición, cuerpo y finanzas). Funciones puras, testeables.
import { weekStart } from "@/lib/gym/stats";

type Status = "done" | "less" | "more" | "skipped" | "cheat";

// ---------------------------------------------------------------------------
// Peso frente a series semanales
// ---------------------------------------------------------------------------

export interface WeekRow {
  week: string;
  sets: number;
  workouts: number;
  /** Peso medio de las medidas de esa semana. */
  weightKg: number | null;
}

export function weightVsSets(
  weeks: string[],
  workoutDays: string[],
  setsByDay: Map<string, number>,
  weights: { day: string; kg: number }[],
): WeekRow[] {
  return weeks.map((week) => {
    const inWeek = (d: string) => weekStart(d) === week;
    const kgs = weights.filter((w) => inWeek(w.day)).map((w) => w.kg);
    return {
      week,
      workouts: workoutDays.filter(inWeek).length,
      sets: [...setsByDay].filter(([d]) => inWeek(d)).reduce((s, [, n]) => s + n, 0),
      weightKg: kgs.length ? Math.round((kgs.reduce((s, k) => s + k, 0) / kgs.length) * 10) / 10 : null,
    };
  });
}

/** Correlación de Pearson (null con menos de 4 pares o sin variación). */
export function correlation(pairs: [number, number][]): number | null {
  if (pairs.length < 4) return null;
  const n = pairs.length;
  const mx = pairs.reduce((s, p) => s + p[0], 0) / n;
  const my = pairs.reduce((s, p) => s + p[1], 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (const [x, y] of pairs) {
    sxy += (x - mx) * (y - my);
    sxx += (x - mx) ** 2;
    syy += (y - my) ** 2;
  }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}

export function correlationLabel(r: number | null): string {
  if (r === null) return "Aún no hay datos suficientes para ver una relación.";
  const strength = Math.abs(r) >= 0.6 ? "clara" : Math.abs(r) >= 0.3 ? "moderada" : "débil o nula";
  if (Math.abs(r) < 0.3) return `Relación ${strength} (r = ${r.toFixed(2).replace(".", ",")}).`;
  return `Relación ${strength} ${r > 0 ? "positiva" : "negativa"} (r = ${r.toFixed(2).replace(".", ",")}).`;
}

// ---------------------------------------------------------------------------
// Días de entreno frente a días de descanso
// ---------------------------------------------------------------------------

export interface DayTypeStats {
  days: number;
  /** Comidas según el plan sobre las previstas (0-1), solo días con algo marcado. */
  adherence: number | null;
  /** Kcal medias de los días con comida apuntada. */
  avgKcal: number | null;
  loggedDays: number;
  cheats: number;
}

export function trainingVsRest(
  days: string[],
  trainingDays: Set<string>,
  checks: { day: string; status: Status }[],
  kcalByDay: Map<string, number>,
  cheatDays: string[],
  mealsPerDay: number,
): { training: DayTypeStats; rest: DayTypeStats } {
  const build = (subset: string[]): DayTypeStats => {
    const set = new Set(subset);
    const dayChecks = checks.filter((c) => set.has(c.day));
    const markedDays = new Set(dayChecks.map((c) => c.day)).size;
    const kcals = subset.map((d) => kcalByDay.get(d)).filter((k): k is number => k !== undefined && k > 0);
    return {
      days: subset.length,
      adherence:
        markedDays && mealsPerDay
          ? Math.min(1, dayChecks.filter((c) => c.status === "done").length / (markedDays * mealsPerDay))
          : null,
      avgKcal: kcals.length ? Math.round(kcals.reduce((s, k) => s + k, 0) / kcals.length) : null,
      loggedDays: kcals.length,
      cheats: cheatDays.filter((d) => set.has(d)).length,
    };
  };
  return {
    training: build(days.filter((d) => trainingDays.has(d))),
    rest: build(days.filter((d) => !trainingDays.has(d))),
  };
}

// ---------------------------------------------------------------------------
// Gasto en comida frente a la dieta, por mes
// ---------------------------------------------------------------------------

export interface MonthFood {
  month: string;
  /** Céntimos gastados (positivo) por subcategoría de comida. */
  spentCents: Record<string, number>;
  totalCents: number;
  adherence: number | null;
  cheats: number;
}

export function foodSpendVsDiet(
  months: string[],
  expenses: { day: string; cents: number; category: string }[],
  checks: { day: string; status: Status }[],
  cheatDays: string[],
): MonthFood[] {
  return months.map((month) => {
    const inMonth = (d: string) => d.startsWith(month);
    const spentCents: Record<string, number> = {};
    for (const e of expenses.filter((x) => inMonth(x.day)))
      spentCents[e.category] = (spentCents[e.category] ?? 0) + Math.abs(e.cents);
    const mc = checks.filter((c) => inMonth(c.day));
    return {
      month,
      spentCents,
      totalCents: Object.values(spentCents).reduce((s, v) => s + v, 0),
      adherence: mc.length ? mc.filter((c) => c.status === "done").length / mc.length : null,
      cheats: cheatDays.filter(inMonth).length,
    };
  });
}
