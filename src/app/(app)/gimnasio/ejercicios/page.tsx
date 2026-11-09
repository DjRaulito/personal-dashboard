import type { Metadata } from "next";
import Link from "next/link";
import { clsx } from "clsx";
import { MuscleSelect } from "@/components/gym/forms";
import { EmptyState, Tile } from "@/components/ui";
import { APP_LOCALE } from "@/lib/datetime";
import { MUSCLE_GROUPS, MUSCLE_LABELS } from "@/lib/gym/muscles";
import { getAllSets, getExercises, getWorkouts, workoutDates } from "@/lib/gym/server";
import { exerciseRecords } from "@/lib/gym/stats";

export const metadata: Metadata = { title: "Ejercicios · Gimnasio" };

const num = (v: number | undefined) =>
  v === undefined ? "—" : `${v.toLocaleString(APP_LOCALE, { maximumFractionDigits: 1 })} kg`;
const shortDate = (d: string | null) =>
  d
    ? new Intl.DateTimeFormat(APP_LOCALE, { day: "numeric", month: "short", year: "2-digit", timeZone: "UTC" }).format(
        new Date(`${d}T00:00:00Z`),
      )
    : "—";

export default async function ExercisesPage({ searchParams }: { searchParams: Promise<{ grupo?: string }> }) {
  const { grupo } = await searchParams;
  const [exercises, sets, workouts] = await Promise.all([getExercises(), getAllSets(), getWorkouts()]);
  const records = exerciseRecords(sets, workoutDates(workouts));
  const used = new Set(exercises.map((e) => e.muscle_group));
  const filter = MUSCLE_GROUPS.find((g) => g === grupo);
  const rows = exercises
    .filter((e) => !filter || e.muscle_group === filter)
    .map((e) => ({ ...e, r: records.get(e.id) }))
    .sort((a, b) => (b.r?.lastDate ?? "").localeCompare(a.r?.lastDate ?? "") || a.name.localeCompare(b.name));

  return (
    <>
      <nav aria-label="Filtrar por grupo muscular" className="flex flex-wrap gap-1.5">
        {[undefined, ...MUSCLE_GROUPS.filter((g) => used.has(g))].map((g) => (
          <Link
            key={g ?? "todos"}
            href={g ? `/gimnasio/ejercicios?grupo=${g}` : "/gimnasio/ejercicios"}
            aria-current={filter === g ? "page" : undefined}
            className={clsx(
              "rounded-full border px-3 py-1 text-sm transition-[background-color,color,transform] duration-150 active:scale-95 motion-reduce:active:scale-100",
              filter === g ? "bg-gym text-ink border-transparent" : "border-border-strong text-muted hover:text-text",
            )}
          >
            {g ? MUSCLE_LABELS[g] : "Todos"}
          </Link>
        ))}
      </nav>
      <Tile className="p-0 sm:p-0">
        {rows.length ? (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-muted text-left text-xs">
                <tr className="border-border border-b">
                  <th scope="col" className="px-5 py-3 font-normal">
                    Ejercicio
                  </th>
                  <th scope="col" className="px-2 py-3 font-normal">
                    Grupo
                  </th>
                  <th scope="col" className="px-2 py-3 text-right font-normal">
                    Sesiones
                  </th>
                  <th scope="col" className="px-2 py-3 text-right font-normal">
                    Mejor 1RM est.
                  </th>
                  <th scope="col" className="px-2 py-3 text-right font-normal">
                    Peso máx.
                  </th>
                  <th scope="col" className="px-5 py-3 text-right font-normal">
                    Última vez
                  </th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {rows.map((e) => (
                  <tr key={e.id} className="border-border border-b last:border-0">
                    <td className="max-w-64 px-5 py-2.5">
                      <Link
                        href={`/gimnasio/ejercicios/${e.id}`}
                        className="hover:text-gym block truncate font-medium transition-colors duration-150"
                      >
                        {e.name}
                      </Link>
                    </td>
                    <td className="px-2 py-2.5">
                      <MuscleSelect exerciseId={e.id} value={e.muscle_group} name={e.name} />
                    </td>
                    <td className="px-2 py-2.5 text-right">{e.r?.sessions ?? 0}</td>
                    <td className="px-2 py-2.5 text-right">{num(e.r?.best1RM?.value)}</td>
                    <td className="px-2 py-2.5 text-right">{num(e.r?.maxWeight?.value)}</td>
                    <td className="text-muted px-5 py-2.5 text-right">{shortDate(e.r?.lastDate ?? null)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState>No hay ejercicios todavía. Importa tus entrenos de Hevy.</EmptyState>
        )}
      </Tile>
      <p className="text-muted text-sm">
        El grupo muscular se deduce del nombre; si alguno está mal, cámbialo en su desplegable y se recordará.
      </p>
    </>
  );
}
