import type { Metadata } from "next";
import { TrendChart, WeeklyBars } from "@/components/gym/charts";
import { EmptyState, Tile, TileTitle } from "@/components/ui";
import { addDaysIso } from "@/lib/ai/assistant";
import {
  correlation,
  correlationLabel,
  foodSpendVsDiet,
  trainingVsRest,
  weightVsSets,
  type DayTypeStats,
} from "@/lib/ai/crosses";
import { APP_LOCALE, dayKey } from "@/lib/datetime";
import { getCategories } from "@/lib/finance/server";
import { formatCents } from "@/lib/finance/money";
import { getMeasurements, getSetsForWorkouts, getWorkouts, workoutDates } from "@/lib/gym/server";
import { isWorkingSet, weeksBetween } from "@/lib/gym/stats";
import { totalsOf } from "@/lib/nutrition/portions";
import { getActivePlan, getCheats, getChecks, getFoods } from "@/lib/nutrition/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Cruces" };

const WEEKS = 16;
const DIET_DAYS = 56;
const MONTHS = 6;
const FOOD_PARENT = "Alimentación";

const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)} %`);
const monthLabel = (m: string) =>
  new Intl.DateTimeFormat(APP_LOCALE, { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${m}-01T00:00:00Z`),
  );

function lastMonths(today: string, n: number): string[] {
  const [y, m] = today.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (n - 1 - i), 1));
    return d.toISOString().slice(0, 7);
  });
}

export default async function CrossesPage() {
  const today = dayKey(new Date());
  const weeks = weeksBetween(addDaysIso(today, -(WEEKS - 1) * 7), today);
  const dietFrom = addDaysIso(today, -(DIET_DAYS - 1));
  const months = lastMonths(today, MONTHS);
  const monthsFrom = `${months[0]}-01`;
  const checksFrom = dietFrom < monthsFrom ? dietFrom : monthsFrom;
  const supabase = await createClient();

  const [workouts, measurements, plan, checks, cheats, foods, logs, categories] = await Promise.all([
    getWorkouts(),
    getMeasurements(),
    getActivePlan(),
    getChecks(checksFrom, today),
    getCheats(),
    getFoods(),
    supabase
      .from("nutrition_logs")
      .select("eaten_on, food_id, grams")
      .gte("eaten_on", dietFrom)
      .lte("eaten_on", today)
      .limit(5000),
    getCategories(),
  ]);

  // Gimnasio y peso
  const dateOf = workoutDates(workouts);
  const recent = workouts.filter((w) => dateOf.get(w.id)! >= weeks[0]);
  const sets = await getSetsForWorkouts(recent.map((w) => w.id));
  const setsByDay = new Map<string, number>();
  for (const s of sets.filter(isWorkingSet)) {
    const d = dateOf.get(s.workout_id)!;
    setsByDay.set(d, (setsByDay.get(d) ?? 0) + 1);
  }
  const weights = measurements
    .filter((m) => m.weight_kg !== null && m.measured_on >= weeks[0])
    .map((m) => ({ day: m.measured_on, kg: m.weight_kg! }))
    .sort((a, b) => a.day.localeCompare(b.day));
  const weekRows = weightVsSets(weeks, [...new Set(recent.map((w) => dateOf.get(w.id)!))], setsByDay, weights);
  // ¿Las semanas con más series coinciden con cambios de peso la semana siguiente?
  const pairs: [number, number][] = [];
  for (let i = 0; i < weekRows.length - 1; i++) {
    const a = weekRows[i];
    const b = weekRows[i + 1];
    if (a.weightKg !== null && b.weightKg !== null) pairs.push([a.sets, b.weightKg - a.weightKg]);
  }

  // Entreno frente a descanso
  const foodMap = new Map(foods.map((f) => [f.id, f]));
  const logsByDay = new Map<string, { food_id: string; grams: number }[]>();
  for (const l of logs.data ?? [])
    logsByDay.set(l.eaten_on, [...(logsByDay.get(l.eaten_on) ?? []), { food_id: l.food_id, grams: Number(l.grams) }]);
  const kcalByDay = new Map([...logsByDay].map(([d, list]) => [d, totalsOf(list, foodMap).kcal]));
  const dietDays = Array.from({ length: DIET_DAYS }, (_, i) => addDaysIso(dietFrom, i));
  const cheatDays = cheats.map((c) => c.eaten_on);
  const split = trainingVsRest(
    dietDays,
    new Set(workouts.map((w) => dateOf.get(w.id)!)),
    checks.filter((c) => c.day >= dietFrom),
    kcalByDay,
    cheatDays,
    plan?.meals.length ?? 0,
  );

  // Gasto en comida frente a la dieta
  const foodParent = categories.find((c) => c.name === FOOD_PARENT && !c.parent_id);
  const foodCats = foodParent ? categories.filter((c) => c.id === foodParent.id || c.parent_id === foodParent.id) : [];
  const { data: tx } = foodCats.length
    ? await supabase
        .from("transactions")
        .select("booked_on, amount_cents, category_id")
        .in(
          "category_id",
          foodCats.map((c) => c.id),
        )
        .gte("booked_on", monthsFrom)
        .lt("amount_cents", 0)
        .limit(5000)
    : { data: [] };
  const catName = new Map(foodCats.map((c) => [c.id, c.id === foodParent?.id ? "Otros" : c.name]));
  const monthRows = foodSpendVsDiet(
    months,
    (tx ?? []).map((t) => ({
      day: t.booked_on,
      cents: t.amount_cents,
      category: catName.get(t.category_id!) ?? "Otros",
    })),
    checks,
    cheatDays,
  );
  const hasSpending = monthRows.some((m) => m.totalCents > 0);

  return (
    <div className="flex flex-col gap-3.5">
      <Tile>
        <TileTitle dot="bg-gym">Peso y volumen de entreno</TileTitle>
        <p className="text-muted mt-1 text-sm">
          Últimas {WEEKS} semanas: series efectivas y peso medio de cada semana.
        </p>
        <div className="mt-5 flex flex-col gap-6">
          {weekRows.some((w) => w.sets > 0) ? (
            <WeeklyBars weeks={weekRows.map((w) => ({ week: w.week, value: w.sets }))} unit="series" />
          ) : (
            <EmptyState>Sin entrenos en estas semanas.</EmptyState>
          )}
          {weights.length >= 2 ? (
            <TrendChart
              points={weights.map((w) => ({ date: w.day, value: w.kg }))}
              unit="kg"
              label="Peso"
              tone="nutrition"
            />
          ) : (
            <EmptyState>Apunta tu peso al menos dos veces para ver la evolución.</EmptyState>
          )}
          <p className="text-sm">
            <span className="text-muted">Series de una semana frente al cambio de peso de la siguiente: </span>
            {correlationLabel(correlation(pairs))}
          </p>
        </div>
      </Tile>

      <Tile>
        <TileTitle dot="bg-nutrition">Días de entreno y de descanso</TileTitle>
        <p className="text-muted mt-1 text-sm">Últimos {DIET_DAYS} días: cómo comes según entrenes o no.</p>
        {plan ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <DayTypeCard title="Días de entreno" stats={split.training} />
            <DayTypeCard title="Días de descanso" stats={split.rest} />
          </div>
        ) : (
          <EmptyState>Configura tu plan nutricional para ver este cruce.</EmptyState>
        )}
      </Tile>

      <Tile>
        <TileTitle dot="bg-finance">Gasto en comida y dieta</TileTitle>
        <p className="text-muted mt-1 text-sm">
          Gasto en {FOOD_PARENT.toLowerCase()} (súper, restaurantes, bares, a domicilio) frente al cumplimiento del
          plan.
        </p>
        {hasSpending || checks.length ? (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[32rem] text-sm">
              <thead className="text-muted text-left text-xs">
                <tr>
                  <th className="py-2 pr-3 font-medium">Mes</th>
                  <th className="py-2 pr-3 text-right font-medium">Gasto comida</th>
                  <th className="py-2 pr-3 font-medium">Detalle</th>
                  <th className="py-2 pr-3 text-right font-medium">Según plan</th>
                  <th className="py-2 text-right font-medium">Cheat</th>
                </tr>
              </thead>
              <tbody>
                {monthRows.map((m) => (
                  <tr key={m.month} className="border-border border-t">
                    <td className="py-2.5 pr-3 first-letter:uppercase">{monthLabel(m.month)}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">
                      {m.totalCents ? formatCents(m.totalCents) : "—"}
                    </td>
                    <td className="text-muted py-2.5 pr-3 text-xs">
                      {Object.entries(m.spentCents)
                        .sort((a, b) => b[1] - a[1])
                        .map(([k, v]) => `${k} ${formatCents(v)}`)
                        .join(" · ")}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{pct(m.adherence)}</td>
                    <td className="py-2.5 text-right tabular-nums">{m.cheats || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!hasSpending && (
              <p className="text-muted mt-3 text-sm">
                Aún no hay gastos de comida: importa movimientos del banco o lee tus tickets con foto.
              </p>
            )}
          </div>
        ) : (
          <EmptyState>Sin gastos de comida ni días marcados en la dieta todavía.</EmptyState>
        )}
      </Tile>
    </div>
  );
}

function DayTypeCard({ title, stats }: { title: string; stats: DayTypeStats }) {
  const rows = [
    { label: "Días", value: String(stats.days) },
    { label: "Comidas según el plan", value: pct(stats.adherence) },
    {
      label: "Kcal medias apuntadas",
      value: stats.avgKcal === null ? "—" : `${stats.avgKcal.toLocaleString(APP_LOCALE)} kcal`,
      hint: stats.loggedDays ? `${stats.loggedDays} días con registro` : undefined,
    },
    { label: "Cheat meals", value: String(stats.cheats) },
  ];
  return (
    <section className="bg-surface-2 rounded-inner p-4">
      <h3 className="font-semibold">{title}</h3>
      <dl className="mt-3 flex flex-col gap-2 text-sm">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-3">
            <dt className="text-muted">
              {r.label}
              {r.hint && <span className="block text-xs">{r.hint}</span>}
            </dt>
            <dd className="font-semibold tabular-nums">{r.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
