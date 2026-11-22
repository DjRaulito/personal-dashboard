import { clsx } from "clsx";
import { niceScale, toPercent } from "@/lib/finance/chart-scale";
import { formatPrice } from "@/lib/tasks/fund";

export interface PriceLevel {
  label: string;
  value: number;
  /** Clase de color de la línea y su etiqueta (text-*). */
  tone: string;
}

const fmtDate = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("es-ES", { timeZone: "UTC", ...opts }).format(new Date(`${iso}T00:00:00Z`));

/** Precio diario (línea) con los niveles de la tesis: compra, entrada, salida, bajista. */
export function PriceChart({
  points,
  levels,
  currency,
}: {
  points: { date: string; value: number }[];
  levels: PriceLevel[];
  currency: string;
}) {
  if (points.length < 2) return null;
  const step = Math.ceil(points.length / 200);
  const data = points.filter((_, i) => i % step === 0 || i === points.length - 1);
  const values = data.map((p) => p.value).concat(levels.map((l) => l.value));
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = (hi - lo) * 0.05 || hi * 0.05;
  const scale = niceScale(lo - pad, hi + pad);
  const x = (i: number) => (i / (data.length - 1)) * 100;
  const y = (v: number) => 100 - toPercent(v, scale.min, scale.max);
  const line = data.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(2)},${y(p.value).toFixed(2)}`).join(" ");
  const area = `${line} L100,100 L0,100 Z`;
  const last = data[data.length - 1];
  const hoverStep = Math.max(1, Math.floor(data.length / 60));
  const hover = data.filter((_, i) => i % hoverStep === 0 || i === data.length - 1);
  const fmt = (v: number) => formatPrice(v, currency);

  return (
    <figure>
      <figcaption className="text-muted mb-4 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="bg-finance inline-block h-0.5 w-3 rounded" /> Precio
        </span>
        {levels.map((l) => (
          <span key={l.label} className="flex items-center gap-2">
            <span aria-hidden="true" className={clsx("inline-block w-3 border-t-2 border-dashed", l.tone)} />
            {l.label} <span className="text-text tabular-nums">{fmt(l.value)}</span>
          </span>
        ))}
      </figcaption>
      <div className="flex gap-2">
        <div
          aria-hidden="true"
          className="text-muted relative w-14 shrink-0 text-right text-[11px] whitespace-nowrap tabular-nums"
        >
          {scale.ticks.map((t) => (
            <span key={`l${t}`} className="absolute right-0 -translate-y-1/2" style={{ top: `${y(t)}%` }}>
              {fmt(t)}
            </span>
          ))}
        </div>
        <div className="relative h-56 flex-1">
          {scale.ticks.map((t) => (
            <span
              key={`g${t}`}
              aria-hidden="true"
              className="bg-border absolute inset-x-0 h-px"
              style={{ top: `${y(t)}%` }}
            />
          ))}
          {levels.map((l) => (
            <span
              key={l.label}
              aria-hidden="true"
              className={clsx("absolute inset-x-0 border-t-2 border-dashed opacity-80", l.tone)}
              style={{ top: `${y(l.value)}%` }}
            />
          ))}
          <svg
            aria-hidden="true"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full overflow-visible"
          >
            <defs>
              <linearGradient id="task-price" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="var(--finance)" stopOpacity="0.25" />
                <stop offset="1" stopColor="var(--finance)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={area} fill="url(#task-price)" />
            <path
              d={line}
              fill="none"
              stroke="var(--finance)"
              strokeWidth="2.5"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <span
            aria-hidden="true"
            className="bg-finance border-surface absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
            style={{ left: "100%", top: `${y(last.value)}%` }}
          />
          <ul className="absolute inset-0 flex">
            {hover.map((p, i) => (
              <li
                key={p.date}
                tabIndex={0}
                aria-label={`${fmtDate(p.date, { dateStyle: "long" })}: ${fmt(p.value)}`}
                className="group relative flex-1 outline-none"
              >
                <span
                  aria-hidden="true"
                  className="bg-border-strong absolute inset-y-0 left-1/2 hidden w-px group-hover:block group-focus-visible:block"
                />
                <div
                  className={clsx(
                    "bg-surface-2 border-border-strong rounded-inner pointer-events-none absolute bottom-full z-10 mb-2 hidden border px-3 py-2 text-xs whitespace-nowrap shadow-lg group-hover:block group-focus-visible:block",
                    i < hover.length / 2 ? "left-0" : "right-0",
                  )}
                >
                  <p className="font-semibold">{fmtDate(p.date, { dateStyle: "long" })}</p>
                  <p className="mt-1 tabular-nums">{fmt(p.value)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div aria-hidden="true" className="text-muted mt-2 ml-16 flex justify-between text-[11px]">
        <span>{fmtDate(data[0].date, { month: "short", year: "numeric" })}</span>
        <span>{fmtDate(last.date, { day: "numeric", month: "short" })}</span>
      </div>
    </figure>
  );
}
