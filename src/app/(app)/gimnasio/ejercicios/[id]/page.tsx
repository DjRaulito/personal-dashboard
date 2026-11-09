import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TrendChart } from "@/components/gym/charts";
import { MuscleSelect } from "@/components/gym/forms";
import { BackLink, EmptyState, Tile, TileTitle } from "@/components/ui";
import { APP_LOCALE } from "@/lib/datetime";
import { getAllSets, getExercises, getWorkouts, workoutDates } from "@/lib/gym/server";
import { exerciseHistory, exerciseRecords } from "@/lib/gym/stats";

export const metadata: Metadata = { title: "Ejercicio · Gimnasio" };

const num = (v: number, digits = 1) => v.toLocaleString(APP_LOCALE, { maximumFractionDigits: digits });
const date = (d: string) =>
  new Intl.DateTimeFormat(APP_LOCALE, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));

export default async function ExercisePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const exercises = await getExercises();
  const exercise = exercises.find((e) => e.id === id);
  if (!exercise) notFound();
  const [sets, workouts] = await Promise.all([getAllSets(id), getWorkouts()]);
  const dateOf = workoutDates(workouts);
  const records = exerciseRecords(sets, dateOf).get(id);
  const history = exerciseHistory(sets, dateOf);
  const workoutOf = new Map<string, string>();
  for (const s of sets) workoutOf.set(`${dateOf.get(s.workout_id)}`, s.workout_id);
  const hasWeights = history.some((h) => h.maxWeight > 0);

  const tiles = [
    records?.best1RM && {
      label: "Mejor 1RM estimado",
      value: `${num(records.best1RM.value)} kg`,
      detail: `${num(records.best1RM.weight, 2)} kg × ${records.best1RM.reps} · ${date(records.best1RM.date)}`,
    },
    records?.maxWeight && {
      label: "Peso máximo",
      value: `${num(records.maxWeight.value, 2)} kg`,
      detail: `× ${records.maxWeight.reps} · ${date(records.maxWeight.date)}`,
    },
    records?.bestSetVolume && {
      label: "Mejor serie (kg × reps)",
      value: `${num(records.bestSetVolume.value, 0)} kg`,
      detail: `${num(records.bestSetVolume.weight, 2)} kg × ${records.bestSetVolume.reps} · ${date(records.bestSetVolume.date)}`,
    },
    records?.maxReps && {
      label: "Más repeticiones",
      value: String(records.maxReps.value),
      detail: date(records.maxReps.date),
    },
  ].filter(Boolean) as { label: string; value: string; detail: string }[];

  return (
    <>
      <BackLink href="/gimnasio/ejercicios">Ejercicios</BackLink>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-balance">{exercise.name}</h2>
          <p className="text-muted mt-1 text-sm">
            {records?.sessions ?? 0} sesiones
            {records?.lastDate && ` · última el ${date(records.lastDate)}`}
          </p>
        </div>
        <MuscleSelect exerciseId={exercise.id} value={exercise.muscle_group} name={exercise.name} />
      </header>

      {tiles.length > 0 && (
        <section aria-label="Récords" className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          {tiles.map((t) => (
            <Tile key={t.label}>
              <p className="text-muted text-sm">{t.label}</p>
              <p className="font-display mt-2 text-2xl font-extrabold tracking-tight tabular-nums">{t.value}</p>
              <p className="text-muted mt-1 text-xs tabular-nums">{t.detail}</p>
            </Tile>
          ))}
        </section>
      )}

      <Tile>
        <TileTitle dot="bg-gym">Progreso</TileTitle>
        <div className="mt-4">
          {hasWeights && history.length >= 2 ? (
            <TrendChart
              points={history
                .filter((h) => h.maxWeight > 0)
                .map((h) => ({ date: h.date, value: h.best1RM || h.maxWeight, secondary: h.maxWeight }))}
              unit="kg"
              label="1RM estimado"
              secondary="Peso máximo"
            />
          ) : (
            <EmptyState>Hacen falta al menos dos sesiones con peso para ver la evolución.</EmptyState>
          )}
        </div>
      </Tile>

      <Tile>
        <TileTitle dot="bg-gym">Sesiones</TileTitle>
        <ul className="mt-3 flex flex-col">
          {[...history]
            .reverse()
            .slice(0, 15)
            .map((h, i) => (
              <li key={`${h.date}-${i}`} className="border-border border-b last:border-0">
                <Link
                  href={`/gimnasio/entreno/${workoutOf.get(h.date)}`}
                  className="hover:bg-surface-2 -mx-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-xl px-2 py-2.5 text-sm transition-colors duration-150"
                >
                  <span className="text-muted w-28 shrink-0">{date(h.date)}</span>
                  <span className="flex-1 tabular-nums">
                    {h.sets} series · máx. {num(h.maxWeight, 2)} kg
                  </span>
                  <span className="text-muted tabular-nums">
                    {h.best1RM ? `1RM ${num(h.best1RM)} kg` : `${num(h.volume, 0)} kg`}
                  </span>
                </Link>
              </li>
            ))}
        </ul>
      </Tile>
    </>
  );
}
