import type { Metadata } from "next";
import { clsx } from "clsx";
import { MeasureChart, ReviewSheetForm, SyncReviewsButton, type MeasureSeries } from "@/components/nutrition/reviews";
import { EmptyState, Tile, TileTitle } from "@/components/ui";
import { APP_LOCALE, dayKey } from "@/lib/datetime";
import { getMeasurements } from "@/lib/gym/server";
import { getCheats, getChecks, getNutritionSettings, getReviews } from "@/lib/nutrition/server";
import { MEASURE_LABELS, MEASURES } from "@/lib/nutrition/sheet";

export const metadata: Metadata = { title: "Revisiones · Nutrición" };

const date = (d: string) =>
  new Intl.DateTimeFormat(APP_LOCALE, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
const num = (v: number | null | undefined, unit = "") =>
  v === null || v === undefined ? "—" : `${v.toLocaleString(APP_LOCALE, { maximumFractionDigits: 2 })}${unit}`;
const delta = (a: number | null | undefined, b: number | null | undefined) =>
  a === null || a === undefined || b === null || b === undefined ? null : Math.round((a - b) * 100) / 100;

export default async function ReviewsPage() {
  const today = dayKey(new Date());
  const [reviews, measurements, cheats, settings] = await Promise.all([
    getReviews(),
    getMeasurements(),
    getCheats(),
    getNutritionSettings(),
  ]);
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

  const lastWeight = measurements.find((m) => m.weight_kg !== null)?.weight_kg;
  const series: MeasureSeries = {};
  for (const key of MEASURES) {
    series[key] = measurements
      .filter((m) => m[key] !== null)
      .map((m) => ({ date: m.measured_on, value: m[key]! }))
      .reverse();
  }
  const withMeasures = measurements.filter((m) => MEASURES.some((k) => m[k] !== null));
  const syncedAt = settings.syncedAt
    ? new Intl.DateTimeFormat(APP_LOCALE, {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Europe/Madrid",
      }).format(new Date(settings.syncedAt))
    : null;

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
            {num(lastWeight, " kg")}
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

      <Tile>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <TileTitle dot="bg-nutrition">Hoja de control</TileTitle>
          {settings.sheetId && (
            <div className="ml-auto">
              <SyncReviewsButton />
            </div>
          )}
        </div>
        <p className="text-muted mt-2 text-sm">
          {settings.sheetId
            ? `Las revisiones se leen de la hoja de tu nutricionista. ${syncedAt ? `Última lectura: ${syncedAt}.` : "Aún no se ha leído desde aquí."}`
            : "Indica cuál es la hoja de cálculo donde tu nutricionista apunta el peso y las medidas."}
        </p>
        <details className="mt-3" open={!settings.sheetId}>
          <summary className="text-muted hover:text-text cursor-pointer text-sm">
            {settings.sheetId ? "Cambiar de hoja" : "Elegir hoja"}
          </summary>
          <div className="mt-3 max-w-xl">
            <ReviewSheetForm configured={Boolean(settings.sheetId)} />
          </div>
        </details>
      </Tile>

      <Tile>
        <TileTitle dot="bg-nutrition">Evolución</TileTitle>
        <div className="mt-4">
          <MeasureChart series={series} />
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
              </li>
            ))}
          </ul>
        )}
      </Tile>

      {withMeasures.length > 0 && (
        <Tile className="p-0 sm:p-0">
          <div className="px-6 pt-6">
            <TileTitle dot="bg-nutrition">Todas las medidas</TileTitle>
          </div>
          <div className="relative mt-3 overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm tabular-nums">
              <thead className="text-muted text-left text-xs">
                <tr className="border-border border-b">
                  <th scope="col" className="px-6 py-2 font-normal">
                    Fecha
                  </th>
                  {MEASURES.map((k) => (
                    <th key={k} scope="col" className="px-2 py-2 text-right font-normal last:pr-6">
                      {MEASURE_LABELS[k]}
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
                      {MEASURES.map((k) => {
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
