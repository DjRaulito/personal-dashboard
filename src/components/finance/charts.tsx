import Link from "next/link";
import { niceScale, toPercent } from "@/lib/finance/chart-scale";
import { formatCents, formatCentsCompact } from "@/lib/finance/money";
import { APP_LOCALE } from "@/lib/datetime";

const monthShort = (iso: string) =>
  new Intl.DateTimeFormat(APP_LOCALE, { month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
const monthLong = (iso: string) =>
  new Intl.DateTimeFormat(APP_LOCALE, { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${iso}T00:00:00Z`),
  );

function Tooltip({ children, align }: { children: React.ReactNode; align: "left" | "right" }) {
  return (
    <div
      role="presentation"
      className={`bg-surface-2 border-border-strong rounded-inner pointer-events-none absolute bottom-full z-10 mb-2 hidden min-w-44 border px-3 py-2 text-xs whitespace-nowrap shadow-lg group-hover:block group-focus-visible:block ${align === "left" ? "left-0" : "right-0"}`}
    >
      {children}
    </div>
  );
}

function Swatch({ className }: { className: string }) {
  return <span aria-hidden="true" className={`inline-block h-2.5 w-2.5 rounded-[3px] ${className}`} />;
}

/** Gasto por categoría: barras horizontales de un solo color. */
export function CategoryBars({
  items,
  currency,
}: {
  items: { id: string; label: string; cents: number; href: string }[];
  currency: string;
}) {
  const max = Math.max(...items.map((i) => i.cents), 1);
  return (
    <ul className="flex flex-col gap-1">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={item.href}
            className="hover:bg-surface-2 focus-visible:outline-content -mx-2 block rounded-xl px-2 py-1.5 focus-visible:outline-2"
          >
            <span className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate">{item.label}</span>
              <span className="text-muted shrink-0 tabular-nums">{formatCents(item.cents, currency)}</span>
            </span>
            <span aria-hidden="true" className="mt-1.5 block h-2.5">
              <span
                className="bg-expense block h-full rounded-r-[4px]"
                style={{ width: `${Math.max((item.cents / max) * 100, 1.5)}%` }}
              />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Ingresos frente a gastos por mes: columnas agrupadas. */
export function CashflowChart({
  data,
  currency,
}: {
  data: { month: string; income: number; expense: number }[];
  currency: string;
}) {
  const scale = niceScale(0, Math.max(...data.flatMap((d) => [d.income, d.expense]), 1));
  return (
    <figure>
      <figcaption className="text-muted mb-6 flex gap-4 text-sm">
        <span className="flex items-center gap-2">
          <Swatch className="bg-finance" /> Ingresos
        </span>
        <span className="flex items-center gap-2">
          <Swatch className="bg-expense" /> Gastos
        </span>
      </figcaption>
      <div className="flex gap-2">
        <div
          aria-hidden="true"
          className="text-muted relative w-14 shrink-0 text-right text-[11px] whitespace-nowrap tabular-nums"
        >
          {scale.ticks.map((t) => (
            <span
              key={t}
              className="absolute right-0 -translate-y-1/2"
              style={{ bottom: `${toPercent(t, 0, scale.max)}%` }}
            >
              {formatCentsCompact(t, currency)}
            </span>
          ))}
        </div>
        <div className="relative h-44 flex-1">
          {scale.ticks.map((t) => (
            <span
              key={t}
              aria-hidden="true"
              className="bg-border absolute inset-x-0 h-px"
              style={{ bottom: `${toPercent(t, 0, scale.max)}%` }}
            />
          ))}
          <ul className="absolute inset-0 flex">
            {data.map((d, i) => (
              <li
                key={d.month}
                tabIndex={0}
                aria-label={`${monthLong(d.month)}: ingresos ${formatCents(d.income, currency)}, gastos ${formatCents(d.expense, currency)}`}
                className="group hover:bg-surface-2/60 focus-visible:bg-surface-2/60 relative flex flex-1 items-end justify-center gap-[2px] rounded-md outline-none"
              >
                <span
                  className="bg-finance block w-full max-w-3 rounded-t-[4px]"
                  style={{ height: `${toPercent(d.income, 0, scale.max)}%` }}
                />
                <span
                  className="bg-expense block w-full max-w-3 rounded-t-[4px]"
                  style={{ height: `${toPercent(d.expense, 0, scale.max)}%` }}
                />
                <Tooltip align={i < data.length / 2 ? "left" : "right"}>
                  <p className="font-semibold first-letter:uppercase">{monthLong(d.month)}</p>
                  <p className="mt-1 flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1.5">
                      <Swatch className="bg-finance" /> Ingresos
                    </span>
                    <span className="tabular-nums">{formatCents(d.income, currency)}</span>
                  </p>
                  <p className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1.5">
                      <Swatch className="bg-expense" /> Gastos
                    </span>
                    <span className="tabular-nums">{formatCents(d.expense, currency)}</span>
                  </p>
                  <p className="text-muted mt-1 flex justify-between gap-3">
                    <span>Balance</span>
                    <span className="tabular-nums">
                      {formatCents(d.income - d.expense, currency, { signed: true })}
                    </span>
                  </p>
                </Tooltip>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div aria-hidden="true" className="text-muted mt-2 ml-16 flex text-[11px]">
        {data.map((d) => (
          <span key={d.month} className="flex-1 text-center">
            {monthShort(d.month)}
          </span>
        ))}
      </div>
      <DataTable
        headers={["Mes", "Ingresos", "Gastos"]}
        rows={data.map((d) => [monthLong(d.month), formatCents(d.income, currency), formatCents(d.expense, currency)])}
      />
    </figure>
  );
}

/** Patrimonio al cierre de cada mes: línea con área. */
export function NetWorthChart({ data, currency }: { data: { month: string; cents: number }[]; currency: string }) {
  if (data.length === 0) return null;
  const values = data.map((d) => d.cents);
  const scale = niceScale(Math.min(0, ...values), Math.max(...values));
  const x = (i: number) => (data.length === 1 ? 50 : (i / (data.length - 1)) * 100);
  const y = (v: number) => 100 - toPercent(v, scale.min, scale.max);
  const line = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(2)},${y(d.cents).toFixed(2)}`).join(" ");
  const area = `${line} L${x(data.length - 1)},${y(Math.max(scale.min, 0))} L${x(0)},${y(Math.max(scale.min, 0))} Z`;
  const last = data[data.length - 1];

  return (
    <figure>
      <div className="mt-2 flex gap-2">
        <div
          aria-hidden="true"
          className="text-muted relative w-14 shrink-0 text-right text-[11px] whitespace-nowrap tabular-nums"
        >
          {scale.ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: `${y(t)}%` }}>
              {formatCentsCompact(t, currency)}
            </span>
          ))}
        </div>
        <div className="relative h-44 flex-1">
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
              <linearGradient id="networth" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="var(--finance)" stopOpacity="0.3" />
                <stop offset="1" stopColor="var(--finance)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={area} fill="url(#networth)" />
            <path
              d={line}
              fill="none"
              stroke="var(--finance)"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <span
            aria-hidden="true"
            className="bg-finance border-surface absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
            style={{ left: `${x(data.length - 1)}%`, top: `${y(last.cents)}%` }}
          />
          <ul className="absolute inset-0 flex">
            {data.map((d, i) => (
              <li
                key={d.month}
                tabIndex={0}
                aria-label={`${monthLong(d.month)}: ${formatCents(d.cents, currency)}`}
                className="group relative flex-1 outline-none"
              >
                <span
                  aria-hidden="true"
                  className="bg-border-strong absolute inset-y-0 left-1/2 hidden w-px group-hover:block group-focus-visible:block"
                />
                <Tooltip align={i < data.length / 2 ? "left" : "right"}>
                  <p className="font-semibold first-letter:uppercase">{monthLong(d.month)}</p>
                  <p className="mt-1 tabular-nums">{formatCents(d.cents, currency)}</p>
                </Tooltip>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div aria-hidden="true" className="text-muted mt-2 ml-16 flex justify-between text-[11px]">
        <span>{monthShort(data[0].month)}</span>
        <span>{monthShort(last.month)}</span>
      </div>
      <DataTable
        headers={["Mes", "Patrimonio"]}
        rows={data.map((d) => [monthLong(d.month), formatCents(d.cents, currency)])}
      />
    </figure>
  );
}

function DataTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <details className="mt-3 text-sm">
      <summary className="text-muted hover:text-text cursor-pointer select-none">Ver datos</summary>
      <table className="mt-2 w-full text-left">
        <thead className="text-muted">
          <tr>
            {headers.map((h, i) => (
              <th key={h} className={`py-1 font-medium ${i > 0 ? "text-right" : ""}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r[0]} className="border-border border-t">
              {r.map((c, i) => (
                <td key={i} className={`py-1 ${i > 0 ? "text-right tabular-nums" : "first-letter:uppercase"}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
