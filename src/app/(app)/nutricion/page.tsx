import type { Metadata } from "next";
import Link from "next/link";
import { MealTracker } from "@/components/nutrition/meal-tracker";
import { CreatePlanForm, LoadCatalogButton } from "@/components/nutrition/setup";
import { buttonClass, Tile, TileTitle } from "@/components/ui";
import { APP_LOCALE, dayKey } from "@/lib/datetime";
import { groupPortionTotals, sumTotals, totalsOf } from "@/lib/nutrition/portions";
import { getActivePlan, getCheats, getDay, getFoods, getReviews } from "@/lib/nutrition/server";

export const metadata: Metadata = { title: "Nutrición · Personal Dashboard" };

const shift = (d: string, days: number) => {
  const date = new Date(`${d}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
const kcal = (v: number) => `${Math.round(v).toLocaleString(APP_LOCALE)} kcal`;

export default async function NutritionTodayPage({ searchParams }: { searchParams: Promise<{ dia?: string }> }) {
  const { dia } = await searchParams;
  const today = dayKey(new Date());
  const day = dia && /^\d{4}-\d{2}-\d{2}$/.test(dia) && dia <= today ? dia : today;
  const [plan, foods, data, cheats, reviews] = await Promise.all([
    getActivePlan(),
    getFoods(),
    getDay(day),
    getCheats(),
    getReviews(),
  ]);

  if (foods.length === 0 || !plan) {
    return (
      <Tile>
        <TileTitle dot="bg-nutrition">Empieza tu plan</TileTitle>
        <p className="text-muted mt-2 text-sm">
          {foods.length === 0
            ? "Primero carga los alimentos básicos (con sus macros por 100 g); luego crea tu plan con las comidas y raciones de tu nutricionista."
            : "Crea tu plan y añade las comidas, grupos y raciones de tu nutricionista."}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {foods.length === 0 ? <LoadCatalogButton /> : <CreatePlanForm />}
        </div>
      </Tile>
    );
  }

  const foodMap = new Map(foods.map((f) => [f.id, f]));
  const eaten = totalsOf(data.logs, foodMap);
  const planned = sumTotals(plan.meals.flatMap((m) => m.groups.map((g) => groupPortionTotals(g, foodMap))));
  const checked = plan.meals.filter((m) => data.checks.has(m.id));
  const ok = checked.filter((m) => data.checks.get(m.id)!.status === "done").length;
  const lastReview = reviews[0]?.review_on ?? null;
  const cheatsSince = cheats.filter((c) => !lastReview || c.eaten_on > lastReview).length;
  const label = new Intl.DateTimeFormat(APP_LOCALE, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${day}T00:00:00Z`));

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <nav aria-label="Día" className="bg-surface border-border flex items-center gap-1 rounded-full border p-1">
          <Link
            href={`/nutricion?dia=${shift(day, -1)}`}
            className="text-muted hover:text-text rounded-full px-3 py-1.5 text-sm"
            aria-label="Día anterior"
          >
            ←
          </Link>
          <span className="px-2 text-sm font-semibold first-letter:uppercase">{day === today ? "Hoy" : label}</span>
          {day < today ? (
            <Link
              href={day === shift(today, -1) ? "/nutricion" : `/nutricion?dia=${shift(day, 1)}`}
              className="text-muted hover:text-text rounded-full px-3 py-1.5 text-sm"
              aria-label="Día siguiente"
            >
              →
            </Link>
          ) : (
            <span className="text-border-strong px-3 py-1.5 text-sm" aria-hidden="true">
              →
            </span>
          )}
        </nav>
        <Link href="/nutricion/cheats" className={`${buttonClass.secondary} ml-auto`}>
          Apuntar cheat meal
        </Link>
      </div>

      <section aria-label="Resumen del día" className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Tile>
          <p className="text-muted text-sm">Comidas marcadas</p>
          <p className="font-display mt-2 text-2xl font-extrabold tracking-tight tabular-nums sm:text-3xl">
            {checked.length}/{plan.meals.length}
          </p>
          <p className="text-muted mt-1 text-xs">{ok} como en el plan</p>
        </Tile>
        <Tile>
          <p className="text-muted text-sm">Apuntado</p>
          <p className="font-display mt-2 text-2xl font-extrabold tracking-tight tabular-nums sm:text-3xl">
            {data.logs.length ? kcal(eaten.kcal) : "—"}
          </p>
          <p className="text-muted mt-1 text-xs">Plan: ~{kcal(planned.kcal)}</p>
        </Tile>
        <Tile>
          <p className="text-muted text-sm">Macros del plan</p>
          <p className="mt-2 text-sm tabular-nums">
            P {Math.round(planned.protein_g)} g · HC {Math.round(planned.carbs_g)} g · G {Math.round(planned.fat_g)} g
          </p>
          <p className="text-muted mt-1 text-xs">Aproximados (mediana de cada grupo)</p>
        </Tile>
        <Tile>
          <p className="text-muted text-sm">Cheat meals</p>
          <p className="font-display mt-2 text-2xl font-extrabold tracking-tight tabular-nums sm:text-3xl">
            {cheatsSince}
          </p>
          <p className="text-muted mt-1 text-xs">{lastReview ? "desde la última revisión" : "en total"}</p>
        </Tile>
      </section>

      <div className="grid gap-3.5 xl:grid-cols-2">
        {plan.meals.map((m) => (
          <MealTracker
            key={`${day}-${m.id}`}
            day={day}
            meal={m}
            foodList={foods}
            initialLogs={data.logs.filter((l) => l.meal_id === m.id)}
            initialStatus={data.checks.get(m.id)?.status ?? null}
          />
        ))}
      </div>
      <p className="text-muted text-sm">
        Los pesos del plan son en crudo. Si apuntas arroz o pasta cocidos, se convierten solos (arroz ÷ 2,5, pasta ÷ 2;
        el factor de cada alimento se cambia en Alimentos).
      </p>
    </>
  );
}
