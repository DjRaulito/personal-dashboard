"use client";

import { useState } from "react";
import { clsx } from "clsx";
import type { MonthReturn } from "@/lib/investments/view";

const MONTHS = ["E", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const MONTH_NAMES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const fmt = (v: number) =>
  `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v * 100).toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;

/**
 * Rentabilidad por meses: barras hacia arriba (sube, celeste) o hacia abajo (baja, naranja) con
 * pestañas por año; «Todos» enseña la cuadrícula de meses × años en los mismos dos colores.
 */
export function MonthlyReturns({ months }: { months: MonthReturn[] }) {
  const byYear = new Map<string, (MonthReturn | null)[]>();
  for (const m of months) {
    const [y, mm] = m.month.split("-");
    const row = byYear.get(y) ?? Array<MonthReturn | null>(12).fill(null);
    row[Number(mm) - 1] = m;
    byYear.set(y, row);
  }
  const years = [...byYear.keys()].sort();
  const [year, setYear] = useState<string>(years.at(-1) ?? "todos");
  if (years.length === 0) return null;
  const yearTotal = (y: string) => (byYear.get(y) ?? []).reduce((acc, m) => (m ? acc * (1 + m.returnPct) : acc), 1) - 1;

  return (
    <div>
      <div role="tablist" aria-label="Año" className="flex flex-wrap gap-1.5">
        {["todos", ...years].map((y) => (
          <button
            key={y}
            type="button"
            role="tab"
            aria-selected={year === y}
            onClick={() => setYear(y)}
            className={clsx(
              "rounded-full border px-3.5 py-1 text-sm font-medium transition-colors",
              year === y
                ? "bg-selected text-on-selected border-transparent"
                : "text-muted border-border hover:text-text",
            )}
          >
            {y === "todos" ? "Todos" : y}
          </button>
        ))}
      </div>
      <div className="mt-5">
        {year === "todos" ? (
          <Grid years={years} byYear={byYear} total={yearTotal} />
        ) : (
          <Bars row={byYear.get(year)!} year={year} total={yearTotal(year)} />
        )}
      </div>
      <p className="text-muted mt-3 text-xs">
        <span className="text-finance">▲ Celeste</span>: el mes subió. <span className="text-expense">▼ Naranja</span>:
        bajó. Rentabilidad ponderada por tiempo, en %.
      </p>
    </div>
  );
}

function Bars({ row, year, total }: { row: (MonthReturn | null)[]; year: string; total: number }) {
  const max = Math.max(0.005, ...row.map((m) => Math.abs(m?.returnPct ?? 0)));
  return (
    <figure>
      <figcaption className="mb-3 text-sm">
        {year}:{" "}
        <span className={clsx("font-semibold tabular-nums", total >= 0 ? "text-finance" : "text-expense")}>
          {total >= 0 ? "▲" : "▼"} {fmt(total)} %
        </span>
      </figcaption>
      <ol className="grid h-56 grid-cols-12 gap-1.5 sm:gap-3">
        {row.map((m, i) => {
          const v = m?.returnPct ?? 0;
          const h = (Math.abs(v) / max) * 50;
          return (
            <li
              key={i}
              className="relative flex flex-col items-center"
              aria-label={m ? `${MONTH_NAMES[i]}: ${fmt(v)} %` : `${MONTH_NAMES[i]}: sin datos`}
            >
              <span aria-hidden="true" className="bg-border-strong absolute inset-x-0 top-1/2 h-px" />
              {m && (
                <>
                  <span
                    aria-hidden="true"
                    className={clsx("absolute w-full max-w-7 rounded-md", v >= 0 ? "bg-finance" : "bg-expense")}
                    style={v >= 0 ? { bottom: "50%", height: `${h}%` } : { top: "50%", height: `${h}%` }}
                  />
                  <span
                    aria-hidden="true"
                    className="text-muted absolute text-[10px] whitespace-nowrap tabular-nums sm:text-[11px]"
                    style={v >= 0 ? { bottom: `calc(50% + ${h}% + 2px)` } : { top: `calc(50% + ${h}% + 2px)` }}
                  >
                    {fmt(v)}
                  </span>
                </>
              )}
              <span aria-hidden="true" className="text-muted absolute -bottom-5 text-[11px]">
                {MONTHS[i]}
              </span>
            </li>
          );
        })}
      </ol>
      <div className="h-5" />
    </figure>
  );
}

function Grid({
  years,
  byYear,
  total,
}: {
  years: string[];
  byYear: Map<string, (MonthReturn | null)[]>;
  total: (y: string) => number;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-separate border-spacing-1 text-center text-xs tabular-nums">
        <thead>
          <tr className="text-muted">
            <th scope="col" className="text-left font-medium">
              Año
            </th>
            {MONTHS.map((m, i) => (
              <th key={i} scope="col" className="font-medium">
                <abbr title={MONTH_NAMES[i]} className="no-underline">
                  {m}
                </abbr>
              </th>
            ))}
            <th scope="col" className="font-medium">
              Año
            </th>
          </tr>
        </thead>
        <tbody>
          {[...years].reverse().map((y) => (
            <tr key={y}>
              <th scope="row" className="text-muted pr-1 text-left font-medium">
                {y}
              </th>
              {byYear.get(y)!.map((m, i) => (
                <td
                  key={i}
                  className={clsx(
                    "rounded-lg py-2",
                    m == null ? "text-muted" : m.returnPct >= 0 ? "bg-finance/25" : "bg-expense/30",
                  )}
                >
                  {m ? fmt(m.returnPct) : "—"}
                </td>
              ))}
              <td className={clsx("rounded-lg py-2 font-semibold", total(y) >= 0 ? "text-finance" : "text-expense")}>
                {fmt(total(y))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
