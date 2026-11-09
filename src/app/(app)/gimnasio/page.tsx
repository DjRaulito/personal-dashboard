import type { Metadata } from "next";
import Link from "next/link";
import { ActivityCalendar, HorizontalBars, WeeklyBars } from "@/components/gym/charts";
import { buttonClass, EmptyState, Tile, TileTitle } from "@/components/ui";
import { APP_LOCALE, dayKey } from "@/lib/datetime";
import { MUSCLE_LABELS, type MuscleGroup } from "@/lib/gym/muscles";
import { getExercises, getSetsForWorkouts, getWorkouts, workoutDates } from "@/lib/gym/server";
import {
  isWorkingSet,
  shiftDays,
  summarizeWorkout,
  weekStart,
  weekStreak,
  weeklySetsByMuscle,
  weeksBetween,
} from "@/lib/gym/stats";

export const metadata: Metadata = { title: "Gimnasio · Personal Dashboard" };

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat(APP_LOCALE, {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Europe/Madrid",
  }).format(new Date(iso));
const kg = (v: number) => `${v.toLocaleString(APP_LOCALE, { maximumFractionDigits: 0 })} kg`;

export default async function GymPage() {
  const today = dayKey(new Date());
  const workouts = await getWorkouts();

  if (workouts.length === 0) {
    return (
      <Tile>
        <TileTitle dot="bg-gym">Aún no hay entrenos</TileTitle>
        <p className="text-muted mt-2 text-sm">
          Exporta tus entrenos desde Hevy (Perfil → Ajustes → Exportar datos → Exportar entrenos) e impórtalos aquí.
        </p>
        <Link href="/gimnasio/importar" className={`${buttonClass.primary} mt-4`}>
          Importar desde Hevy
        </Link>
      </Tile>
    );
  }

  const thisWeek = weekStart(today);
  const from12 = shiftDays(thisWeek, -7 * 11);
  const from4 = shiftDays(thisWeek, -7 * 3);
  const dateOf = workoutDates(workouts);
  const recentIds = workouts.filter((w) => dateOf.get(w.id)! >= from12).map((w) => w.id);
  const latestIds = workouts.slice(0, 8).map((w) => w.id);
  const [sets, exercises] = await Promise.all([
    getSetsForWorkouts([...new Set([...recentIds, ...latestIds])]),
    getExercises(),
  ]);

  const days = workouts.map((w) => dateOf.get(w.id)!);
  const monthKey = today.slice(0, 7);
  const thisMonth = days.filter((d) => d.startsWith(monthKey)).length;
  const streak = weekStreak(days, today);
  const weekWorkouts = days.filter((d) => d >= thisWeek).length;
  const weekSets = sets.filter((s) => (dateOf.get(s.workout_id) ?? "") >= thisWeek && isWorkingSet(s)).length;

  const setsByWorkout = new Map<string, typeof sets>();
  for (const s of sets) setsByWorkout.set(s.workout_id, [...(setsByWorkout.get(s.workout_id) ?? []), s]);
  const last4 = workouts.filter((w) => dateOf.get(w.id)! >= from4);
  const durations = last4
    .map((w) => summarizeWorkout(w, setsByWorkout.get(w.id) ?? []).durationMin)
    .filter((d): d is number => d !== null && d > 0);
  const avgDuration = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null;

  const weeks12 = weeksBetween(from12, today);
  const perWeek = weeks12.map((week) => ({ week, value: days.filter((d) => weekStart(d) === week).length }));
  const calendarWeeks = weeksBetween(shiftDays(thisWeek, -7 * 19), today);

  const muscleOf = new Map(exercises.map((e) => [e.id, e.muscle_group]));
  const weekly = weeklySetsByMuscle(sets, dateOf, muscleOf, from4);
  const totals = new Map<MuscleGroup, number>();
  for (const row of weekly.values()) for (const [m, n] of row) totals.set(m, (totals.get(m) ?? 0) + n);
  const muscleBars = [...totals]
    .filter(([m]) => m !== "cardio")
    .map(([m, n]) => ({ label: MUSCLE_LABELS[m], value: Math.round((n / 4) * 10) / 10 }))
    .sort((a, b) => b.value - a.value);

  const tiles = [
    { label: "Entrenos este mes", value: String(thisMonth) },
    { label: "Racha", value: `${streak} ${streak === 1 ? "semana" : "semanas"}` },
    { label: "Esta semana", value: `${weekWorkouts} · ${weekSets} series` },
    { label: "Duración media", value: avgDuration ? `${avgDuration} min` : "—" },
  ];

  return (
    <>
      <section aria-label="Resumen" className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {tiles.map((t) => (
          <Tile key={t.label}>
            <p className="text-muted text-sm">{t.label}</p>
            <p className="font-display mt-3 text-2xl font-extrabold tracking-tight tabular-nums sm:text-3xl">
              {t.value}
            </p>
          </Tile>
        ))}
      </section>

      <div className="grid gap-3.5 lg:grid-cols-5">
        <Tile className="lg:col-span-3">
          <TileTitle dot="bg-gym">Últimas 20 semanas</TileTitle>
          <div className="mt-5 overflow-x-auto">
            <ActivityCalendar weeks={calendarWeeks} active={new Set(days)} today={today} />
          </div>
          <h3 className="text-muted mt-6 text-sm">Entrenos por semana</h3>
          <div className="mt-3">
            <WeeklyBars weeks={perWeek} unit="entrenos" />
          </div>
        </Tile>
        <Tile className="lg:col-span-2">
          <TileTitle dot="bg-gym">Series por grupo muscular</TileTitle>
          <p className="text-muted mt-1 text-sm">Series efectivas por semana, media de las últimas 4.</p>
          <div className="mt-4">
            {muscleBars.length ? (
              <HorizontalBars items={muscleBars} unit="series" />
            ) : (
              <EmptyState>Sin series en las últimas 4 semanas.</EmptyState>
            )}
          </div>
        </Tile>
      </div>

      <Tile>
        <TileTitle dot="bg-gym">Últimos entrenos</TileTitle>
        <ul className="mt-4 flex flex-col">
          {workouts.slice(0, 8).map((w) => {
            const s = summarizeWorkout(w, setsByWorkout.get(w.id) ?? []);
            return (
              <li key={w.id} className="border-border border-b last:border-0">
                <Link
                  href={`/gimnasio/entreno/${w.id}`}
                  className="hover:bg-surface-2 -mx-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-xl px-2 py-3 transition-colors duration-150 active:opacity-80"
                >
                  <span className="text-muted w-24 shrink-0 text-sm first-letter:uppercase">
                    {fmtDate(w.started_at)}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">{w.title}</span>
                  <span className="text-muted text-sm tabular-nums">
                    {s.durationMin ? `${s.durationMin} min · ` : ""}
                    {s.sets} series · {kg(s.volumeKg)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        <p className="text-muted mt-3 text-sm">
          {workouts.length} entrenos desde el{" "}
          {new Intl.DateTimeFormat(APP_LOCALE, { dateStyle: "long", timeZone: "Europe/Madrid" }).format(
            new Date(workouts[workouts.length - 1].started_at),
          )}
          .
        </p>
      </Tile>
    </>
  );
}
