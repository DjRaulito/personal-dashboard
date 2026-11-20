"use client";

import { useEffect, useState } from "react";
import { clsx } from "clsx";
import { HISTORY_RANGES, type HistoryRange, type HistoryResult } from "@/lib/investments/history";

const LABELS: Record<HistoryRange, string> = {
  "1D": "1D",
  "1S": "1S",
  "1M": "1M",
  YTD: "YTD",
  "1A": "1A",
  "3A": "3A",
  "5A": "5A",
};
const PERIOD_TEXT: Record<HistoryRange, string> = {
  "1D": "en el último día",
  "1S": "en una semana",
  "1M": "en un mes",
  YTD: "este año",
  "1A": "en un año",
  "3A": "en 3 años",
  "5A": "en 5 años",
};

const fmtPct = (v: number) =>
  `${v > 0 ? "▲ +" : v < 0 ? "▼ −" : ""}${Math.abs(v * 100).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;
const fmtDate = (d: string) =>
  new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${d}T00:00:00Z`),
  );

/** Evolución del precio de la posición con los periodos 1D, 1S, 1M, YTD, 1A, 3A y 5A. */
export function PositionHistory({ assetId, currency }: { assetId: string; currency: string }) {
  const [range, setRange] = useState<HistoryRange>("1A");
  const [state, setState] = useState<{ key: string; data: HistoryResult | null; error: boolean } | null>(null);
  const key = `${assetId}:${range}`;

  useEffect(() => {
    let alive = true;
    fetch(`/api/investments/history?activo=${assetId}&rango=${range}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: HistoryResult) => alive && setState({ key, data, error: false }))
      .catch(() => alive && setState({ key, data: null, error: true }));
    return () => {
      alive = false;
    };
  }, [assetId, range, key]);

  const current = state?.key === key ? state : null;
  const data = current?.data;
  const change = data?.changePct ?? null;

  return (
    <section aria-label="Evolución del precio" className="bg-surface-2 rounded-inner flex flex-col gap-3 p-4">
      <p className="text-sm" aria-live="polite">
        {!current ? (
          <span className="text-muted">Cargando…</span>
        ) : current.error ? (
          <span className="text-attention">! No se pudo cargar el histórico.</span>
        ) : change == null ? (
          <span className="text-muted">Sin precios en este periodo.</span>
        ) : (
          <>
            <span className={clsx("font-semibold tabular-nums", change >= 0 ? "text-finance" : "text-expense")}>
              {fmtPct(change)}
            </span>{" "}
            <span className="text-muted">{PERIOD_TEXT[range]}</span>
          </>
        )}
      </p>
      <Line points={data?.points ?? []} currency={currency} up={(change ?? 0) >= 0} />
      <div role="tablist" aria-label="Periodo" className="flex flex-wrap gap-1">
        {HISTORY_RANGES.map((r) => (
          <button
            key={r}
            type="button"
            role="tab"
            aria-selected={r === range}
            onClick={() => setRange(r)}
            className={clsx(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              r === range ? "bg-selected text-on-selected" : "text-muted hover:text-text",
            )}
          >
            {LABELS[r]}
          </button>
        ))}
      </div>
    </section>
  );
}

function Line({ points, currency, up }: { points: { date: string; value: number }[]; currency: string; up: boolean }) {
  if (points.length < 2) return <div className="h-32" aria-hidden="true" />;
  const step = Math.ceil(points.length / 250);
  const data = points.filter((_, i) => i % step === 0 || i === points.length - 1);
  const values = data.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => (i / (data.length - 1)) * 100;
  const y = (v: number) => 92 - ((v - min) / span) * 84;
  const d = data.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(2)},${y(p.value).toFixed(2)}`).join(" ");
  const first = data[0];
  const last = data.at(-1)!;
  const color = up ? "var(--finance)" : "var(--expense)";
  const num = (v: number) => v.toLocaleString("es-ES", { maximumFractionDigits: 4 });
  return (
    <figure>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="h-32 w-full overflow-visible"
        role="img"
        aria-label={`De ${num(first.value)} ${currency} el ${fmtDate(first.date)} a ${num(last.value)} ${currency} el ${fmtDate(last.date)}`}
      >
        <path d={`${d} L100,100 L0,100 Z`} fill={color} opacity="0.12" />
        <path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <figcaption aria-hidden="true" className="text-muted mt-1 flex justify-between text-[11px] tabular-nums">
        <span>
          {fmtDate(first.date)} · {num(first.value)}
        </span>
        <span>
          {fmtDate(last.date)} · {num(last.value)} {currency}
        </span>
      </figcaption>
    </figure>
  );
}
