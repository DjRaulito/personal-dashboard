import type { Metadata } from "next";
import Link from "next/link";
import { DayChecklist, type MealStatus } from "@/components/nutrition/day-checklist";
import { CreatePlanForm, LoadCatalogButton } from "@/components/nutrition/setup";
import { buttonClass, Tile, TileTitle } from "@/components/ui";
import { APP_LOCALE, dayKey } from "@/lib/datetime";
import { groupPortionTotals, sumTotals } from "@/lib/nutrition/portions";
import { getActivePlan, getDay, getFoods } from "@/lib/nutrition/server";

export const metadata: Metadata = { title: "Nutrición · Personal Dashboard" };

const shift = (d: string, days: number) => {
  const date = new Date(`${d}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
const round = (v: number) => Math.round(v).toLocaleString(APP_LOCALE);

export default async function NutritionPlanPage({ searchParams }: { searchParams: Promise<{ dia?: string }> }) {
  const { dia } = await searchParams;
  const today = dayKey(new Date());
  const day = dia && /^\d{4}-\d{2}-\d{2}$/.test(dia) && dia <= today ? dia : today;
  const [plan, foods, data] = await Promise.all([getActivePlan(), getFoods(), getDay(day)]);

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
  const planned = sumTotals(plan.meals.flatMap((m) => m.groups.map((g) => groupPortionTotals(g, foodMap))));
  const macroKcal = planned.protein_g * 4 + planned.carbs_g * 4 + planned.fat_g * 9;
  const macros = [
    { label: "Proteína", grams: planned.protein_g, share: (planned.protein_g * 4) / macroKcal },
    { label: "Hidratos", grams: planned.carbs_g, share: (planned.carbs_g * 4) / macroKcal },
    { label: "Grasa", grams: planned.fat_g, share: (planned.fat_g * 9) / macroKcal },
  ];
  const label = new Intl.DateTimeFormat(APP_LOCALE, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${day}T00:00:00Z`));
  const initial: Record<string, MealStatus> = {};
  for (const m of plan.meals) {
    const check = data.checks.get(m.id);
    if (check) initial[m.id] = check.status;
  }

  return (
    <>
      <section aria-label="Kcal y macros del plan" className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Tile>
          <p className="text-muted text-sm">Kcal al día</p>
          <p className="font-display mt-2 text-2xl font-extrabold tabular-nums sm:text-3xl">{round(planned.kcal)}</p>
          <p className="text-muted mt-1 text-xs">{plan.name}</p>
        </Tile>
        {macros.map((m) => (
          <Tile key={m.label}>
            <p className="text-muted text-sm">{m.label}</p>
            <p className="font-display mt-2 text-2xl font-extrabold tabular-nums sm:text-3xl">{round(m.grams)} g</p>
            <p className="text-muted mt-1 text-xs">
              {macroKcal > 0 ? `${Math.round(m.share * 100)} % de las kcal` : "—"}
            </p>
          </Tile>
        ))}
      </section>
      <p className="text-muted -mt-2 text-xs">
        Valores aproximados: una ración de cada grupo de cada comida (la opción intermedia de cada grupo).
      </p>

      {/* Lo de hoy delante; las notas del plan al lado en escritorio */}
      <div className="grid items-start gap-3.5 lg:grid-cols-5">
        <Tile className="lg:col-span-3">
          <div className="flex flex-wrap items-center gap-3">
            <TileTitle dot="bg-nutrition">¿Cómo ha ido?</TileTitle>
            <nav
              aria-label="Día"
              className="bg-surface-2 border-border ml-auto flex items-center gap-1 rounded-full border p-1"
            >
              <Link
                href={`/nutricion?dia=${shift(day, -1)}`}
                className="text-muted hover:text-text rounded-full px-3 py-1 text-sm"
                aria-label="Día anterior"
              >
                ←
              </Link>
              <span className="px-2 text-sm font-semibold first-letter:uppercase">{day === today ? "Hoy" : label}</span>
              {day < today ? (
                <Link
                  href={day === shift(today, -1) ? "/nutricion" : `/nutricion?dia=${shift(day, 1)}`}
                  className="text-muted hover:text-text rounded-full px-3 py-1 text-sm"
                  aria-label="Día siguiente"
                >
                  →
                </Link>
              ) : (
                <span className="text-border-strong px-3 py-1 text-sm" aria-hidden="true">
                  →
                </span>
              )}
            </nav>
          </div>
          <div className="mt-3">
            <DayChecklist
              key={day}
              day={day}
              meals={plan.meals.map((m) => ({ id: m.id, name: m.name }))}
              initial={initial}
            />
          </div>
        </Tile>
        <Tile className="lg:col-span-2">
          <div className="flex flex-wrap items-center gap-3">
            <TileTitle dot="bg-nutrition">Notas del plan</TileTitle>
            <Link href="/nutricion/plan" className={`${buttonClass.secondary} ml-auto`}>
              Ver o editar comidas y raciones
            </Link>
          </div>
          {plan.notes ? (
            <p className="mt-3 text-sm leading-relaxed whitespace-pre-line">{plan.notes}</p>
          ) : (
            <p className="text-muted mt-3 text-sm">Sin notas. Puedes añadirlas al editar el plan.</p>
          )}
        </Tile>
      </div>
    </>
  );
}
