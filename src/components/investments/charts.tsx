import { niceScale, toPercent } from "@/lib/finance/chart-scale";
import { formatCents, formatCentsCompact } from "@/lib/finance/money";
import { APP_LOCALE } from "@/lib/datetime";

const fmtDate = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(APP_LOCALE, { timeZone: "UTC", ...opts }).format(new Date(`${iso}T00:00:00Z`));
const eur = (v: number) => formatCents(Math.round(v * 100));

/** Valor de la cartera (área) frente a lo aportado (línea). */
export function ValueChart({ points }: { points: { date: string; value: number; invested: number }[] }) {
  if (points.length < 2) return null;
  // Como mucho ~200 puntos para no cargar el SVG
  const step = Math.ceil(points.length / 200);
  const data = points.filter((_, i) => i % step === 0 || i === points.length - 1);
  const all = data.flatMap((p) => [p.value, p.invested]);
  const scale = niceScale(Math.min(0, ...all), Math.max(...all));
  const x = (i: number) => (i / (data.length - 1)) * 100;
  const y = (v: number) => 100 - toPercent(v, scale.min, scale.max);
  const path = (key: "value" | "invested") =>
    data.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(2)},${y(p[key]).toFixed(2)}`).join(" ");
  const area = `${path("value")} L100,${y(Math.max(0, scale.min))} L0,${y(Math.max(0, scale.min))} Z`;
  const last = data[data.length - 1];
  const hoverStep = Math.max(1, Math.floor(data.length / 60));
  const hover = data.filter((_, i) => i % hoverStep === 0 || i === data.length - 1);

  return (
    <figure>
      <figcaption className="text-muted mb-5 flex gap-4 text-sm">
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="bg-finance inline-block h-2.5 w-2.5 rounded-[3px]" /> Valor
        </span>
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="bg-muted inline-block h-0.5 w-3 rounded" /> Aportado
        </span>
      </figcaption>
      <div className="flex gap-2">
        <div
          aria-hidden="true"
          className="text-muted relative w-14 shrink-0 text-right text-[11px] whitespace-nowrap tabular-nums"
        >
          {scale.ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: `${y(t)}%` }}>
              {formatCentsCompact(t * 100)}
            </span>
          ))}
        </div>
        <div className="relative h-52 flex-1">
          {scale.ticks.map((t) => (
            <span
              key={t}
              aria-hidden="true"
              className="bg-border absolute inset-x-0 h-px"
              style={{ top: `${y(t)}%` }}
            />
          ))}
          <svg
            aria-hidden="true"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full overflow-visible"
          >
            <defs>
              <linearGradient id="portfolio-value" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="var(--finance)" stopOpacity="0.3" />
                <stop offset="1" stopColor="var(--finance)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={area} fill="url(#portfolio-value)" />
            <path
              d={path("invested")}
              fill="none"
              stroke="var(--text-muted)"
              strokeWidth="2"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d={path("value")}
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
                aria-label={`${fmtDate(p.date, { dateStyle: "long" })}: valor ${eur(p.value)}, aportado ${eur(p.invested)}`}
                className="group relative flex-1 outline-none"
              >
                <span
                  aria-hidden="true"
                  className="bg-border-strong absolute inset-y-0 left-1/2 hidden w-px group-hover:block group-focus-visible:block"
                />
                <div
                  className={`bg-surface-2 border-border-strong rounded-inner pointer-events-none absolute bottom-full z-10 mb-2 hidden min-w-44 border px-3 py-2 text-xs whitespace-nowrap shadow-lg group-hover:block group-focus-visible:block ${i < hover.length / 2 ? "left-0" : "right-0"}`}
                >
                  <p className="font-semibold">{fmtDate(p.date, { dateStyle: "long" })}</p>
                  <p className="mt-1 flex justify-between gap-3">
                    <span>Valor</span>
                    <span className="tabular-nums">{eur(p.value)}</span>
                  </p>
                  <p className="flex justify-between gap-3">
                    <span>Aportado</span>
                    <span className="tabular-nums">{eur(p.invested)}</span>
                  </p>
                  <p className="text-muted flex justify-between gap-3">
                    <span>Ganancia</span>
                    <span className="tabular-nums">
                      {formatCents(Math.round((p.value - p.invested) * 100), "EUR", { signed: true })}
                    </span>
                  </p>
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

/** Ganancia o pérdida de cada día: barras desde el cero. */
export function DailyPnlChart({ points }: { points: { date: string; pnl: number }[] }) {
  if (points.length === 0) return null;
  const max = Math.max(...points.map((p) => Math.abs(p.pnl)), 1);
  const scale = niceScale(-max, max, 2);
  const zero = toPercent(0, scale.min, scale.max);
  return (
    <figure>
      <div className="flex gap-2">
        <div
          aria-hidden="true"
          className="text-muted relative w-14 shrink-0 text-right text-[11px] whitespace-nowrap tabular-nums"
        >
          {scale.ticks.map((t) => (
            <span
              key={t}
              className="absolute right-0 translate-y-1/2"
              style={{ bottom: `${toPercent(t, scale.min, scale.max)}%` }}
            >
              {formatCentsCompact(t * 100)}
            </span>
          ))}
        </div>
        <ul className="relative flex h-40 flex-1 gap-[2px]">
          <span
            aria-hidden="true"
            className="bg-border-strong absolute inset-x-0 h-px"
            style={{ bottom: `${zero}%` }}
          />
          {points.map((p, i) => {
            const h = (Math.abs(p.pnl) / (scale.max - scale.min)) * 100;
            const up = p.pnl >= 0;
            return (
              <li
                key={p.date}
                tabIndex={0}
                aria-label={`${fmtDate(p.date, { dateStyle: "long" })}: ${formatCents(Math.round(p.pnl * 100), "EUR", { signed: true })}`}
                className="group hover:bg-surface-2/60 relative flex-1 rounded-sm outline-none"
              >
                <span
                  className={`absolute inset-x-0 mx-auto block max-w-3 ${up ? "bg-finance rounded-t-[3px]" : "bg-expense rounded-b-[3px]"}`}
                  style={up ? { bottom: `${zero}%`, height: `${h}%` } : { top: `${100 - zero}%`, height: `${h}%` }}
                />
                <div
                  className={`bg-surface-2 border-border-strong rounded-inner pointer-events-none absolute bottom-full z-10 mb-2 hidden border px-3 py-2 text-xs whitespace-nowrap shadow-lg group-hover:block group-focus-visible:block ${i < points.length / 2 ? "left-0" : "right-0"}`}
                >
                  <p className="font-semibold">
                    {fmtDate(p.date, { weekday: "short", day: "numeric", month: "short" })}
                  </p>
                  <p className="tabular-nums">{formatCents(Math.round(p.pnl * 100), "EUR", { signed: true })}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      <div aria-hidden="true" className="text-muted mt-2 ml-16 flex justify-between text-[11px]">
        <span>{fmtDate(points[0].date, { day: "numeric", month: "short" })}</span>
        <span>{fmtDate(points[points.length - 1].date, { day: "numeric", month: "short" })}</span>
      </div>
    </figure>
  );
}

/** Reparto en una barra segmentada (como mucho 4 partes + leyenda). */
export function AllocationBar({ parts }: { parts: { label: string; value: number; className: string }[] }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  if (total <= 0) return null;
  return (
    <div>
      <div
        className="flex h-7 gap-[2px] overflow-hidden"
        role="img"
        aria-label={parts.map((p) => `${p.label} ${Math.round((p.value / total) * 100)} %`).join(", ")}
      >
        {parts
          .filter((p) => p.value > 0)
          .map((p) => {
            const share = p.value / total;
            return (
              <span
                key={p.label}
                className={`${p.className} text-ink flex items-center rounded-[4px] px-2 text-xs font-semibold`}
                style={{ width: `${share * 100}%` }}
                title={`${p.label}: ${eur(p.value)} (${Math.round(share * 100)} %)`}
              >
                {share > 0.12 ? `${Math.round(share * 100)} %` : ""}
              </span>
            );
          })}
      </div>
      <ul className="text-muted mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {parts
          .filter((p) => p.value > 0)
          .map((p) => (
            <li key={p.label} className="flex items-center gap-2">
              <span aria-hidden="true" className={`inline-block h-2.5 w-2.5 rounded-[3px] ${p.className}`} />
              {p.label} <span className="text-text tabular-nums">{eur(p.value)}</span>
            </li>
          ))}
      </ul>
    </div>
  );
}
