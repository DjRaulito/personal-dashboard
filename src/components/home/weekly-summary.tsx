import { Markdown } from "@/components/ai/markdown";
import { aiConfigured } from "@/lib/ai/llm";
import type { WeeklyStats } from "@/lib/ai/weekly";
import { getWeeklyComment, getWeeklyData } from "@/lib/ai/weekly-server";
import { WeeklyCommentButton } from "./weekly-comment-button";

const short = (day: string) =>
  new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${day}T00:00:00Z`),
  );
const num = (v: number, digits = 0) =>
  new Intl.NumberFormat("es-ES", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(v);

/** Tarjeta de la portada con las cifras de la semana pasada y el comentario de la IA. */
export function WeeklySummary({ stats, comment }: { stats: WeeklyStats; comment: string | null }) {
  const items = [
    { label: "Gasto", value: stats.expenseEur === null ? "—" : `${num(stats.expenseEur)} €` },
    { label: "Entrenos", value: `${stats.workouts}`, hint: stats.sets ? `${stats.sets} series` : undefined },
    {
      label: "Dieta",
      value: stats.dietRatio === null ? "—" : `${Math.round(stats.dietRatio * 100)} %`,
      hint: stats.cheats ? `${stats.cheats} cheat` : stats.dietRatio === null ? undefined : "según el plan",
    },
    {
      label: "Peso",
      value: stats.weightKg === null ? "—" : `${num(stats.weightKg, 1)} kg`,
      hint:
        stats.weightDeltaKg === null
          ? undefined
          : `${stats.weightDeltaKg > 0 ? "+" : ""}${num(stats.weightDeltaKg, 1)} kg`,
    },
  ];
  return (
    <article className="rounded-tile border-border bg-surface flex flex-col gap-4 border p-6 md:col-span-6">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="bg-content h-2.5 w-2.5 rounded-full" />
        <h2 className="font-semibold">Tu semana</h2>
        <span className="text-muted text-sm">
          {short(stats.start)} – {short(stats.end)}
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map((i) => (
          <div key={i.label} className="bg-surface-2 rounded-inner px-4 py-3">
            <dt className="text-muted text-xs">{i.label}</dt>
            <dd className="font-display mt-1 text-xl font-extrabold tracking-tight tabular-nums">{i.value}</dd>
            {i.hint && <dd className="text-muted text-xs tabular-nums">{i.hint}</dd>}
          </div>
        ))}
      </dl>
      {comment && (
        <div className="text-sm">
          <Markdown text={comment} />
        </div>
      )}
      {aiConfigured() && <WeeklyCommentButton regenerate={Boolean(comment)} />}
    </article>
  );
}

/** Versión asíncrona: se carga en streaming para no frenar el resto de la portada. */
export async function WeeklySummaryAsync({ today }: { today: string }) {
  const { stats } = await getWeeklyData(today);
  return <WeeklySummary stats={stats} comment={await getWeeklyComment(stats.start)} />;
}
