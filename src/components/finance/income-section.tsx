import Link from "next/link";
import { clsx } from "clsx";
import { EmptyState, Tile, TileTitle } from "@/components/ui";
import { bettingByPeriod, bettingResult, salaryFor, sumByMonth } from "@/lib/finance/income";
import { formatCents } from "@/lib/finance/money";
import { financePeriods, monthsBetween } from "@/lib/finance/periods";
import { getAccounts, getIncomeData } from "@/lib/finance/server";
import { createClient } from "@/lib/supabase/server";

const MONTH = new Intl.DateTimeFormat("es-ES", { month: "short", timeZone: "UTC" });
const MONTH_LONG = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric", timeZone: "UTC" });

/** Análisis: salario frente a gastos de los últimos 12 meses y resultado de las casas de apuestas. */
export async function IncomeSection() {
  const p = financePeriods(new Date(), 12);
  const supabase = await createClient();
  const [cashflow, income, accounts] = await Promise.all([
    supabase.rpc("monthly_cashflow", { p_from: p.windowStart, p_to: p.nextMonthStart }),
    getIncomeData("2000-01-01"),
    getAccounts(),
  ]);
  const expenses = new Map((cashflow.data ?? []).map((r) => [r.month.slice(0, 7), r.expense_cents]));
  const detected = sumByMonth(income.salary);
  const months = monthsBetween(p.windowStart, p.nextMonthStart).map((m) => {
    const key = m.slice(0, 7);
    return {
      key,
      label: MONTH.format(new Date(`${m}T00:00:00Z`)).replace(".", ""),
      salary: salaryFor(key, detected, income.fallbackSalaryCents, p.monthKey).cents,
      spent: expenses.get(key) ?? 0,
    };
  });
  const max = Math.max(1, ...months.flatMap((m) => [m.salary, m.spent]));
  const withSalary = months.filter((m) => m.salary > 0);
  const savedPct = withSalary.length
    ? withSalary.reduce((s, m) => s + (m.salary - m.spent), 0) / withSalary.reduce((s, m) => s + m.salary, 0)
    : null;

  const betting = accounts.filter((a) => a.type === "betting" && !a.archived);
  const bettingBalance = betting.reduce((s, a) => s + a.balance_cents, 0);
  const years = bettingByPeriod(income.betting, "year");
  const lastMonths = bettingByPeriod(income.betting, "month").slice(0, 6);

  return (
    <div className="grid gap-3.5 lg:grid-cols-5">
      <Tile className="lg:col-span-3">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <TileTitle>Salario frente a gastos</TileTitle>
          {savedPct != null && (
            <span className="text-muted text-sm tabular-nums">
              Ahorras de media el {Math.round(savedPct * 100)} % del salario
            </span>
          )}
        </div>
        {withSalary.length === 0 ? (
          <EmptyState>
            Aún no hay nóminas. Sincroniza tus extractos en Gastos o apunta tu salario en{" "}
            <Link href="/ajustes/finanzas" className="text-text underline">
              Ajustes → Finanzas
            </Link>
            .
          </EmptyState>
        ) : (
          <>
            <ol className="mt-5 grid h-44 grid-cols-12 items-end gap-1.5 sm:gap-2.5">
              {months.map((m) => (
                <li
                  key={m.key}
                  className="flex h-full flex-col justify-end"
                  aria-label={`${MONTH_LONG.format(new Date(`${m.key}-01T00:00:00Z`))}: salario ${formatCents(m.salary)}, gastos ${formatCents(m.spent)}`}
                >
                  <div aria-hidden="true" className="flex h-full items-end justify-center gap-0.5">
                    <span
                      className="w-1/2 max-w-3 rounded-t bg-white/45"
                      style={{ height: `${(m.salary / max) * 100}%` }}
                    />
                    <span
                      className="bg-expense w-1/2 max-w-3 rounded-t"
                      style={{ height: `${(m.spent / max) * 100}%` }}
                    />
                  </div>
                  <span aria-hidden="true" className="text-muted mt-1.5 text-center text-[10px] sm:text-[11px]">
                    {m.label}
                  </span>
                </li>
              ))}
            </ol>
            <p className="text-muted mt-3 flex gap-4 text-xs">
              <span className="flex items-center gap-1.5">
                <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-[3px] bg-white/45" /> Salario
              </span>
              <span className="flex items-center gap-1.5">
                <span aria-hidden="true" className="bg-expense inline-block h-2.5 w-2.5 rounded-[3px]" /> Gastos
              </span>
            </p>
          </>
        )}
      </Tile>

      <Tile className="lg:col-span-2">
        <TileTitle dot="bg-attention">Casas de apuestas</TileTitle>
        {income.betting.length === 0 && betting.length === 0 ? (
          <EmptyState>
            Sin movimientos con casas de apuestas. Crea una cuenta de tipo «Casa de apuestas» en Ajustes para llevar su
            saldo.
          </EmptyState>
        ) : (
          <>
            <p className="text-muted mt-4 text-sm">Resultado total</p>
            {(() => {
              const total = bettingResult(income.betting, bettingBalance);
              return (
                <p
                  className={clsx(
                    "font-display text-3xl font-extrabold tabular-nums",
                    total >= 0 ? "text-finance" : "text-expense",
                  )}
                >
                  {total >= 0 ? "▲ " : "▼ "}
                  {formatCents(total, "EUR", { signed: true })}
                </p>
              );
            })()}
            <p className="text-muted text-xs">
              Lo retirado − lo ingresado
              {betting.length > 0 && ` + ${formatCents(bettingBalance)} que queda en las casas`}.
            </p>
            <table className="mt-4 w-full text-sm tabular-nums">
              <thead>
                <tr className="text-muted text-xs">
                  <th scope="col" className="py-1.5 text-left font-medium">
                    Periodo
                  </th>
                  <th scope="col" className="py-1.5 text-right font-medium">
                    Metido
                  </th>
                  <th scope="col" className="py-1.5 text-right font-medium">
                    Sacado
                  </th>
                  <th scope="col" className="py-1.5 text-right font-medium">
                    Neto
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...lastMonths, ...years].map((r) => (
                  <tr key={r.key} className="border-border border-t">
                    <th scope="row" className="py-2 text-left font-medium first-letter:uppercase">
                      {r.key.length === 4 ? `Año ${r.key}` : MONTH_LONG.format(new Date(`${r.key}-01T00:00:00Z`))}
                    </th>
                    <td className="py-2 text-right">{formatCents(r.depositedCents)}</td>
                    <td className="py-2 text-right">{formatCents(r.withdrawnCents)}</td>
                    <td
                      className={clsx(
                        "py-2 text-right font-semibold",
                        r.netCents >= 0 ? "text-finance" : "text-expense",
                      )}
                    >
                      {formatCents(r.netCents, "EUR", { signed: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </Tile>
    </div>
  );
}
