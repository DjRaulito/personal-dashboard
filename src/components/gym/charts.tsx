import { clsx } from "clsx";
import { APP_LOCALE } from "@/lib/datetime";
import { niceScale, toPercent } from "@/lib/finance/chart-scale";

const fmtDay = (iso: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) =>
  new Intl.DateTimeFormat(APP_LOCALE, { timeZone: "UTC", ...opts }).format(new Date(`${iso}T00:00:00Z`));

function Tooltip({ children, align }: { children: React.ReactNode; align: "left" | "right" }) {
  return (
    <div
      role="presentation"
      className={clsx(
        "bg-surface-2 border-border-strong rounded-inner pointer-events-none absolute bottom-full z-10 mb-2 hidden min-w-36 border px-3 py-2 text-xs whitespace-nowrap shadow-lg group-hover:block group-focus-visible:block",
        align === "left" ? "left-0" : "right-0",
      )}
    >
      {children}
    </div>
  );
}

/** Evolución de un valor (1RM estimado, peso corporal…): línea con puntos. */
export function TrendChart({
  points,
  unit,
  label,
  secondary,
}: {
  points: { date: string; value: number; secondary?: number }[];
  unit: string;
  label: string;
  secondary?: string;
}) {
  if (points.length < 2) return null;
  const step = Math.ceil(points.length / 150);
  const data = points.filter((_, i) => i % step === 0 || i === points.length - 1);
  const values = data.flatMap((p) => (p.secondary !== undefined ? [p.value, p.secondary] : [p.value]));
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const scale = niceScale(Math.max(0, lo - (hi - lo) * 0.1), hi + (hi - lo) * 0.05 || hi + 1);
  const x = (i: number) => (i / (data.length - 1)) * 100;
  const y = (v: number) => 100 - toPercent(v, scale.min, scale.max);
  const path = (get: (p: (typeof data)[number]) => number | undefined) =>
    data
      .map((p, i) => [i, get(p)] as const)
      .filter(([, v]) => v !== undefined)
      .map(([i, v], k) => `${k ? "L" : "M"}${x(i).toFixed(2)},${y(v!).toFixed(2)}`)
      .join(" ");
  const fmt = (v: number) => `${v.toLocaleString(APP_LOCALE, { maximumFractionDigits: 1 })} ${unit}`;
  const last = data[data.length - 1];

  return (
    <figure>
      <figcaption className="text-muted mb-4 flex flex-wrap gap-4 text-sm">
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="bg-gym inline-block h-2.5 w-2.5 rounded-[3px]" /> {label}
        </span>
        {secondary && (
          <span className="flex items-center gap-2">
            <span aria-hidden="true" className="bg-muted inline-block h-0.5 w-3 rounded" /> {secondary}
          </span>
        )}
      </figcaption>
      <div className="flex gap-2">
        <div aria-hidden="true" className="text-muted relative w-12 shrink-0 text-right text-[11px] tabular-nums">
          {scale.ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: `${y(t)}%` }}>
              {t}
            </span>
          ))}
        </div>
        <div className="relative h-48 flex-1">
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
            {secondary && (
              <path
                d={path((p) => p.secondary)}
                fill="none"
                stroke="var(--text-muted)"
                strokeWidth="1.5"
                strokeDasharray="3 3"
                vectorEffect="non-scaling-stroke"
              />
            )}
            <path
              d={path((p) => p.value)}
              fill="none"
              stroke="var(--gym)"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <span
            aria-hidden="true"
            className="bg-gym border-surface absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
            style={{ left: "100%", top: `${y(last.value)}%` }}
          />
          <ul className="absolute inset-0 flex">
            {data.map((p, i) => (
              <li
                key={`${p.date}-${i}`}
                tabIndex={0}
                aria-label={`${fmtDay(p.date, { dateStyle: "long" })}: ${fmt(p.value)}`}
                className="group relative flex-1 outline-none"
              >
                <span
                  aria-hidden="true"
                  className="bg-border-strong absolute inset-y-0 left-1/2 hidden w-px group-hover:block group-focus-visible:block"
                />
                <Tooltip align={i < data.length / 2 ? "left" : "right"}>
                  <p className="font-semibold">{fmtDay(p.date, { dateStyle: "medium" })}</p>
                  <p className="mt-1 tabular-nums">
                    {label}: {fmt(p.value)}
                  </p>
                  {secondary && p.secondary !== undefined && (
                    <p className="text-muted tabular-nums">
                      {secondary}: {fmt(p.secondary)}
                    </p>
                  )}
                </Tooltip>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div aria-hidden="true" className="text-muted mt-2 ml-14 flex justify-between text-[11px]">
        <span>{fmtDay(data[0].date, { month: "short", year: "numeric" })}</span>
        <span>{fmtDay(last.date, { month: "short", year: "numeric" })}</span>
      </div>
    </figure>
  );
}

/** Columnas por semana (entrenos o series). */
export function WeeklyBars({ weeks, unit }: { weeks: { week: string; value: number }[]; unit: string }) {
  const max = Math.max(1, ...weeks.map((w) => w.value));
  return (
    <figure>
      <div className="relative flex h-32 items-end gap-1">
        {weeks.map((w, i) => (
          <div
            key={w.week}
            tabIndex={0}
            aria-label={`Semana del ${fmtDay(w.week, { dateStyle: "long" })}: ${w.value} ${unit}`}
            className="group hover:bg-surface-2/60 focus-visible:bg-surface-2/60 relative flex h-full flex-1 items-end justify-center rounded-md outline-none"
          >
            <span
              className={clsx("block w-full max-w-4 rounded-t-[4px]", w.value ? "bg-gym" : "bg-border")}
              style={{ height: `${w.value ? Math.max((w.value / max) * 100, 4) : 2}%` }}
            />
            <Tooltip align={i < weeks.length / 2 ? "left" : "right"}>
              <p className="font-semibold">Semana del {fmtDay(w.week)}</p>
              <p className="mt-1 tabular-nums">
                {w.value} {unit}
              </p>
            </Tooltip>
          </div>
        ))}
      </div>
      <div aria-hidden="true" className="text-muted mt-2 flex justify-between text-[11px]">
        <span>{fmtDay(weeks[0].week)}</span>
        <span>Esta semana</span>
      </div>
    </figure>
  );
}

/** Calendario de actividad: una columna por semana, una fila por día (lunes arriba). */
export function ActivityCalendar({ weeks, active, today }: { weeks: string[]; active: Set<string>; today: string }) {
  const days = ["L", "M", "X", "J", "V", "S", "D"];
  const addDays = (d: string, n: number) => {
    const date = new Date(`${d}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + n);
    return date.toISOString().slice(0, 10);
  };
  return (
    <div className="flex gap-1.5">
      <div aria-hidden="true" className="text-muted grid grid-rows-7 gap-1 text-[10px] leading-none">
        {days.map((d) => (
          <span key={d} className="flex h-3 items-center sm:h-3.5">
            {d}
          </span>
        ))}
      </div>
      <ol className="flex flex-1 justify-between gap-1" aria-label="Días con entreno">
        {weeks.map((week) => (
          <li key={week} className="grid grid-rows-7 gap-1">
            {days.map((_, i) => {
              const day = addDays(week, i);
              const on = active.has(day);
              const future = day > today;
              return (
                <span
                  key={day}
                  title={`${fmtDay(day, { dateStyle: "medium" })}${on ? " · entreno" : ""}`}
                  className={clsx(
                    "block h-3 w-3 rounded-[3px] sm:h-3.5 sm:w-3.5",
                    on ? "bg-gym" : future ? "bg-transparent" : "bg-surface-2",
                    day === today && "ring-border-strong ring-1",
                  )}
                >
                  <span className="sr-only">{on ? `${fmtDay(day, { dateStyle: "long" })}: entreno` : ""}</span>
                </span>
              );
            })}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Barras horizontales (series por grupo muscular). */
export function HorizontalBars({ items, unit }: { items: { label: string; value: number }[]; unit: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((item) => (
        <li key={item.label}>
          <p className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate">{item.label}</span>
            <span className="text-muted shrink-0 tabular-nums">
              {item.value.toLocaleString(APP_LOCALE, { maximumFractionDigits: 1 })} {unit}
            </span>
          </p>
          <span aria-hidden="true" className="mt-1.5 block h-2.5">
            <span
              className="bg-gym block h-full rounded-r-[4px]"
              style={{ width: `${Math.max((item.value / max) * 100, 1.5)}%` }}
            />
          </span>
        </li>
      ))}
    </ul>
  );
}
