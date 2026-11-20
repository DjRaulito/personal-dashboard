"use client";

import { useActionState, useState, useTransition } from "react";
import { clsx } from "clsx";
import { RefreshCw } from "lucide-react";
import { saveReviewSheet, syncReviews } from "@/app/(app)/nutricion/actions";
import { TrendChart } from "@/components/nutrition/trend-chart";
import { buttonClass, EmptyState, Field, FormMessage, inputClass } from "@/components/ui";
import { MEASURE_LABELS, MEASURES, type Measure } from "@/lib/nutrition/sheet";

/** Botón «Actualizar»: vuelve a leer la hoja de control de la nutricionista. */
export function SyncReviewsButton() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={pending}
        className={buttonClass.primary}
        onClick={() =>
          start(async () => {
            setResult(null);
            const res = await syncReviews();
            if (!res.ok) return setResult({ ok: false, text: res.message });
            const parts = [
              res.added ? `${res.added} ${res.added === 1 ? "revisión nueva" : "revisiones nuevas"}` : "",
              res.updated ? `${res.updated} ${res.updated === 1 ? "corregida" : "corregidas"}` : "",
            ].filter(Boolean);
            setResult({ ok: true, text: parts.length ? `Hecho: ${parts.join(" y ")}.` : "Ya estaba todo al día." });
          })
        }
      >
        <RefreshCw
          aria-hidden="true"
          className={clsx("h-4 w-4", pending && "animate-spin motion-reduce:animate-none")}
          strokeWidth={1.75}
        />
        {pending ? "Leyendo la hoja…" : "Actualizar"}
      </button>
      {result && (
        <p
          role={result.ok ? "status" : "alert"}
          className={clsx("text-sm", result.ok ? "text-muted" : "text-attention")}
        >
          {result.text}
        </p>
      )}
    </div>
  );
}

/** Enlace de la hoja de control (Google Sheets) de la que se leen las revisiones. */
export function ReviewSheetForm({ configured }: { configured: boolean }) {
  const [state, action, pending] = useActionState(saveReviewSheet, { ok: false });
  return (
    <form action={action} autoComplete="off" className="flex flex-col gap-3">
      <Field label="Enlace de la hoja de control (Google Sheets)" error={state.errors?.sheet}>
        <input
          name="sheet"
          required
          placeholder={configured ? "Pega otro enlace para cambiarla" : "https://docs.google.com/spreadsheets/d/…"}
          className={inputClass}
        />
      </Field>
      <FormMessage state={state} />
      <div>
        <button type="submit" disabled={pending} className={buttonClass.secondary}>
          {pending ? "Guardando…" : configured ? "Cambiar hoja" : "Guardar hoja"}
        </button>
      </div>
    </form>
  );
}

export type MeasureSeries = Partial<Record<Measure, { date: string; value: number }[]>>;

/** Evolución de una sola medida, a elegir. */
export function MeasureChart({ series }: { series: MeasureSeries }) {
  const available = MEASURES.filter((m) => (series[m]?.length ?? 0) > 0);
  const [selected, setSelected] = useState<Measure>(available[0] ?? "weight_kg");
  const points = series[selected] ?? [];
  const unit = selected === "weight_kg" ? "kg" : "cm";
  const first = points[0];
  const last = points[points.length - 1];
  const diff = first && last ? Math.round((last.value - first.value) * 100) / 100 : null;
  const fmt = (v: number) => v.toLocaleString("es-ES", { maximumFractionDigits: 2 });

  if (available.length === 0) return <EmptyState>Aún no hay medidas. Pulsa «Actualizar».</EmptyState>;
  return (
    <div className="flex flex-col gap-5">
      <div role="group" aria-label="Medida" className="-mx-1 flex flex-wrap gap-1.5 px-1">
        {available.map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={m === selected}
            className={clsx(
              "rounded-full px-3.5 py-1.5 text-sm font-medium transition-[background-color,color,transform] duration-150 active:scale-95 motion-reduce:active:scale-100",
              m === selected ? "bg-nutrition text-ink" : "bg-surface-2 text-muted hover:text-text",
            )}
            onClick={() => setSelected(m)}
          >
            {MEASURE_LABELS[m]}
          </button>
        ))}
      </div>
      {last && (
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-display text-3xl font-extrabold tracking-tight tabular-nums">
            {fmt(last.value)} {unit}
          </span>
          {diff !== null && points.length > 1 && (
            <span className="text-muted text-sm tabular-nums">
              {diff > 0 ? "+" : ""}
              {fmt(diff)} {unit} desde la primera revisión
            </span>
          )}
        </p>
      )}
      {points.length >= 2 ? (
        <TrendChart key={selected} points={points} unit={unit} label={MEASURE_LABELS[selected]} tone="nutrition" />
      ) : (
        <EmptyState>Hacen falta dos revisiones con esta medida.</EmptyState>
      )}
    </div>
  );
}
