import type { Metadata } from "next";
import { clsx } from "clsx";
import { TrendChart } from "@/components/gym/charts";
import { DeleteButton, ReviewForm } from "@/components/nutrition/forms";
import { EmptyState, Tile, TileTitle } from "@/components/ui";
import { APP_LOCALE, dayKey } from "@/lib/datetime";
import { getMeasurements } from "@/lib/gym/server";
import { getCheats, getChecks, getReviews } from "@/lib/nutrition/server";

export const metadata: Metadata = { title: "Revisiones · Nutrición" };

const date = (d: string) =>
  new Intl.DateTimeFormat(APP_LOCALE, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
const num = (v: number | null | undefined, unit = "") =>
  v === null || v === undefined ? "—" : `${v.toLocaleString(APP_LOCALE, { maximumFractionDigits: 2 })}${unit}`;
const delta = (a: number | null | undefined, b: number | null | undefined) =>
  a === null || a === undefined || b === null || b === undefined ? null : Math.round((a - b) * 100) / 100;

const COLUMNS = [
  ["weight_kg", "Peso"],
  ["chest_cm", "Pecho"],
  ["shoulder_cm", "Hombro"],
  ["arm_cm", "Brazo"],
  ["abdomen_cm", "Abdomen"],
  ["waist_cm", "Cintura"],
  ["hip_cm", "Cadera"],
  ["thigh_cm", "Muslo"],
  ["calf_cm", "Gemelo"],
] as const;

export default async function ReviewsPage() {
  const today = dayKey(new Date());
  const [reviews, measurements, cheats] = await Promise.all([getReviews(), getMeasurements(), getCheats()]);
  const oldest = reviews[reviews.length - 1]?.review_on ?? today;
  const checks = await getChecks(oldest, today);
  const byDate = new Map(measurements.map((m) => [m.measured_on, m]));

  // Periodo de cada revisión: desde la anterior (excluida) hasta esta (incluida)
  const rows = reviews.map((r, i) => {
    const prev = reviews[i + 1]?.review_on ?? null;
    const inPeriod = (d: string) => d <= r.review_on && (!prev || d > prev);
    const periodChecks = checks.filter((c) => inPeriod(c.day));
    const m = byDate.get(r.review_on);
    const pm = prev ? byDate.get(prev) : undefined;
    return {
      ...r,
      m,
      weightDelta: delta(m?.weight_kg, pm?.weight_kg),
      waistDelta: delta(m?.waist_cm, pm?.waist_cm),
      cheats: cheats.filter((c) => inPeriod(c.eaten_on)).length,
      checks: periodChecks.length,
      onPlan: periodChecks.filter((c) => c.status === "done").length,
    };
  });
  // Periodo en curso (desde la última revisión)
  const last = reviews[0]?.review_on ?? null;
  const currentChecks = checks.filter((c) => !last || c.day > last);
  const currentCheats = cheats.filter((c) => !last || c.eaten_on > last).length;

  const weights = measurements
    .filter((m) => m.weight_kg !== null)
    .map((m) => ({ date: m.measured_on, value: m.weight_kg!, secondary: undefined as number | undefined }))
    .reverse();
  const waist = measurements
    .filter((m) => m.waist_cm !== null || m.abdomen_cm !== null)
    .map((m) => ({ date: m.measured_on, value: (m.abdomen_cm ?? m.waist_cm)!, secondary: m.waist_cm ?? undefined }))
    .reverse();
  const withMeasures = measurements.filter((m) => COLUMNS.some(([k]) => m[k] !== null));

  return (
    <>
      <section aria-label="Periodo actual" className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Tile>
          <p className="text-muted text-sm">Última revisión</p>
          <p className="font-display mt-2 text-2xl font-extrabold tracking-tight">{last ? date(last) : "—"}</p>
          {reviews[0]?.phase && <p className="text-muted mt-1 text-xs">{reviews[0].phase}</p>}
        </Tile>
        <Tile>
          <p className="text-muted text-sm">Peso actual</p>
          <p className="font-display mt-2 text-2xl font-extrabold tracking-tight tabular-nums">
            {num(weights[weights.length - 1]?.value, " kg")}
          </p>
        </Tile>
        <Tile>
          <p className="text-muted text-sm">Comidas según el plan</p>
          <p className="font-display mt-2 text-2xl font-extrabold tracking-tight tabular-nums">
            {currentChecks.length
              ? `${Math.round((currentChecks.filter((c) => c.status === "done").length / currentChecks.length) * 100)} %`
              : "—"}
          </p>
          <p className="text-muted mt-1 text-xs">de {currentChecks.length} marcadas desde la última revisión</p>
        </Tile>
        <Tile>
          <p className="text-muted text-sm">Cheat meals</p>
          <p className="font-display mt-2 text-2xl font-extrabold tracking-tight tabular-nums">{currentCheats}</p>
          <p className="text-muted mt-1 text-xs">desde la última revisión</p>
        </Tile>
      </section>

      <div className="grid gap-3.5 lg:grid-cols-2">
        <Tile>
          <TileTitle dot="bg-nutrition">Peso</TileTitle>
          <div className="mt-4">
            {weights.length >= 2 ? (
              <TrendChart points={weights} unit="kg" label="Peso" tone="nutrition" />
            ) : (
              <EmptyState>Hacen falta dos revisiones con peso.</EmptyState>
            )}
          </div>
        </Tile>
        <Tile>
          <TileTitle dot="bg-nutrition">Abdomen y cintura</TileTitle>
          <div className="mt-4">
            {waist.length >= 2 ? (
              <TrendChart points={waist} unit="cm" label="Abdomen" secondary="Cintura" tone="nutrition" />
            ) : (
              <EmptyState>Hacen falta dos revisiones con medidas.</EmptyState>
            )}
          </div>
        </Tile>
      </div>

      <Tile>
        <TileTitle dot="bg-nutrition">Nueva revisión</TileTitle>
        <p className="text-muted mt-1 text-sm">Cada 14 días: peso, perímetros en cm y cómo ha ido.</p>
        <div className="mt-4">
          <ReviewForm today={today} lastPhase={reviews[0]?.phase ?? null} />
        </div>
      </Tile>

      <Tile>
        <TileTitle dot="bg-nutrition">Revisiones ({reviews.length})</TileTitle>
        {rows.length === 0 ? (
          <EmptyState>Aún no hay revisiones.</EmptyState>
        ) : (
          <ul className="mt-3 flex flex-col">
            {rows.map((r) => (
              <li
                key={r.id}
                className="border-border flex flex-wrap items-start gap-x-4 gap-y-2 border-t py-3 first:border-0"
              >
                <div className="w-28 shrink-0">
                  <p className="text-sm font-medium">{date(r.review_on)}</p>
                  {r.phase && <p className="text-muted text-xs">{r.phase}</p>}
                </div>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="tabular-nums">
                    {num(r.m?.weight_kg, " kg")}
                    {r.weightDelta !== null && (
                      <span className="text-muted">
                        {" "}
                        ({r.weightDelta > 0 ? "+" : ""}
                        {num(r.weightDelta)})
                      </span>
                    )}
                    {r.m?.waist_cm != null && (
                      <span className="text-muted">
                        {" "}
                        · cintura {num(r.m.waist_cm, " cm")}
                        {r.waistDelta !== null && ` (${r.waistDelta > 0 ? "+" : ""}${num(r.waistDelta)})`}
                      </span>
                    )}
                  </p>
                  <p className="text-muted mt-0.5 text-xs">
                    {r.adherence ? `Valoración ${r.adherence}/5 · ` : ""}
                    {r.cheats} cheat meals
                    {r.checks > 0 && ` · ${Math.round((r.onPlan / r.checks) * 100)} % de comidas según el plan`}
                  </p>
                  {r.notes && <p className="mt-1 text-xs">{r.notes}</p>}
                </div>
                <DeleteButton kind="review" id={r.id} label={`la revisión del ${date(r.review_on)}`} />
              </li>
            ))}
          </ul>
        )}
      </Tile>

      {withMeasures.length > 0 && (
        <Tile className="p-0 sm:p-0">
          <div className="px-6 pt-6">
            <TileTitle dot="bg-nutrition">Hoja de control</TileTitle>
          </div>
          <div className="relative mt-3 overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm tabular-nums">
              <thead className="text-muted text-left text-xs">
                <tr className="border-border border-b">
                  <th scope="col" className="px-6 py-2 font-normal">
                    Fecha
                  </th>
                  {COLUMNS.map(([k, l]) => (
                    <th key={k} scope="col" className="px-2 py-2 text-right font-normal last:pr-6">
                      {l}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {withMeasures.map((m, i) => {
                  const prev = withMeasures[i + 1];
                  return (
                    <tr key={m.id} className="border-border border-b last:border-0">
                      <td className="px-6 py-2">{date(m.measured_on)}</td>
                      {COLUMNS.map(([k]) => {
                        const d = delta(m[k], prev?.[k]);
                        return (
                          <td
                            key={k}
                            className={clsx("px-2 py-2 text-right last:pr-6", d !== null && d !== 0 && "font-medium")}
                            title={d !== null ? `${d > 0 ? "+" : ""}${d}` : undefined}
                          >
                            {num(m[k])}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Tile>
      )}
    </>
  );
}
