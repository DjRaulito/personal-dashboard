import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { clsx } from "clsx";
import { BackLink, Tile } from "@/components/ui";
import { APP_LOCALE } from "@/lib/datetime";
import { MUSCLE_LABELS } from "@/lib/gym/muscles";
import { getExercises, getSetsForWorkouts } from "@/lib/gym/server";
import { estimated1RM, summarizeWorkout } from "@/lib/gym/stats";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Entreno · Gimnasio" };

const SET_BADGE = { warmup: "C", failure: "F", dropset: "D", normal: null } as const;
const SET_TITLE = { warmup: "Calentamiento", failure: "Al fallo", dropset: "Drop set", normal: "Serie" } as const;
const num = (v: number | null, digits = 1) =>
  v === null ? "—" : v.toLocaleString(APP_LOCALE, { maximumFractionDigits: digits });

export default async function WorkoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = await createClient();
  const { data: workout } = await supabase
    .from("gym_workouts")
    .select("id, title, description, started_at, ended_at")
    .eq("id", id)
    .maybeSingle();
  if (!workout) notFound();
  const [sets, exercises] = await Promise.all([getSetsForWorkouts([id]), getExercises()]);
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const summary = summarizeWorkout(workout, sets);

  // Bloques en el orden del entreno
  const blocks: { index: number; exerciseId: string; sets: typeof sets }[] = [];
  for (const s of sets) {
    const last = blocks[blocks.length - 1];
    if (last && last.index === s.exercise_index) last.sets.push(s);
    else blocks.push({ index: s.exercise_index, exerciseId: s.exercise_id, sets: [s] });
  }

  const when = new Intl.DateTimeFormat(APP_LOCALE, {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Europe/Madrid",
  }).format(new Date(workout.started_at));

  return (
    <>
      <BackLink href="/gimnasio">Resumen</BackLink>
      <header>
        <h2 className="font-display text-3xl font-extrabold tracking-tight text-balance">{workout.title}</h2>
        <p className="text-muted mt-1 first-letter:uppercase">{when}</p>
        {workout.description && <p className="mt-2 text-sm">{workout.description}</p>}
      </header>
      <section aria-label="Resumen del entreno" className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        {[
          ["Duración", summary.durationMin ? `${summary.durationMin} min` : "—"],
          ["Ejercicios", String(summary.exercises)],
          ["Series", String(summary.sets)],
          ["Volumen", `${num(summary.volumeKg, 0)} kg`],
        ].map(([label, value]) => (
          <Tile key={label}>
            <p className="text-muted text-sm">{label}</p>
            <p className="font-display mt-2 text-2xl font-extrabold tracking-tight tabular-nums">{value}</p>
          </Tile>
        ))}
      </section>
      <div className="grid gap-3.5 md:grid-cols-2">
        {blocks.map((b) => {
          const exercise = byId.get(b.exerciseId);
          let n = 0;
          return (
            <Tile key={b.index}>
              <div className="flex items-baseline justify-between gap-3">
                <Link
                  href={`/gimnasio/ejercicios/${b.exerciseId}`}
                  className="hover:text-gym min-w-0 truncate font-semibold transition-colors duration-150"
                >
                  {exercise?.name ?? "Ejercicio"}
                </Link>
                {exercise && (
                  <span className="text-muted shrink-0 text-xs">{MUSCLE_LABELS[exercise.muscle_group]}</span>
                )}
              </div>
              {b.sets[0].superset_id !== null && <p className="text-content mt-1 text-xs">Superserie</p>}
              {b.sets[0].exercise_notes && <p className="text-muted mt-1 text-sm">{b.sets[0].exercise_notes}</p>}
              <table className="mt-3 w-full text-sm tabular-nums">
                <thead className="text-muted text-left text-xs">
                  <tr>
                    <th scope="col" className="py-1 font-normal">
                      Serie
                    </th>
                    <th scope="col" className="py-1 text-right font-normal">
                      Peso
                    </th>
                    <th scope="col" className="py-1 text-right font-normal">
                      Reps
                    </th>
                    <th scope="col" className="py-1 text-right font-normal">
                      RPE
                    </th>
                    <th scope="col" className="py-1 text-right font-normal">
                      1RM est.
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {b.sets.map((s) => {
                    const badge = SET_BADGE[s.set_type];
                    if (!badge) n += 1;
                    const cardio = s.weight_kg === null && s.reps === null;
                    return (
                      <tr
                        key={s.set_index}
                        className={clsx("border-border border-t", s.set_type === "warmup" && "text-muted")}
                      >
                        <td className="py-1.5" title={SET_TITLE[s.set_type]}>
                          {badge ? (
                            <span
                              className={clsx(
                                "font-semibold",
                                s.set_type === "failure" && "text-expense",
                                s.set_type === "dropset" && "text-content",
                              )}
                            >
                              {badge}
                            </span>
                          ) : (
                            n
                          )}
                        </td>
                        {cardio ? (
                          <td colSpan={4} className="py-1.5 text-right">
                            {[
                              s.distance_m ? `${num(s.distance_m / 1000, 2)} km` : null,
                              s.duration_s ? `${Math.round(s.duration_s / 60)} min` : null,
                            ]
                              .filter(Boolean)
                              .join(" · ") || "—"}
                          </td>
                        ) : (
                          <>
                            <td className="py-1.5 text-right">
                              {s.weight_kg === null ? "—" : `${num(s.weight_kg, 2)} kg`}
                            </td>
                            <td className="py-1.5 text-right">{s.reps ?? "—"}</td>
                            <td className="py-1.5 text-right">{num(s.rpe)}</td>
                            <td className="text-muted py-1.5 text-right">
                              {s.set_type === "warmup" ? "—" : num(estimated1RM(s.weight_kg, s.reps))}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Tile>
          );
        })}
      </div>
    </>
  );
}
