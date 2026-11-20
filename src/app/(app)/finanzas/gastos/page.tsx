import type { Metadata } from "next";
import Link from "next/link";
import { clsx } from "clsx";
import { CategoryBars } from "@/components/finance/charts";
import { SyncStatementsButton } from "@/components/finance/sync-statements";
import { TransactionForm } from "@/components/finance/transaction-form";
import { TransactionFilters } from "@/components/finance/transaction-filters";
import { TransactionsTable } from "@/components/finance/transactions-table";
import { buttonClass, EmptyState, Tile, TileTitle } from "@/components/ui";
import { dayKey } from "@/lib/datetime";
import { categoryLabels, categoryOptions } from "@/lib/finance/categories";
import { filtersHref, monthBounds, PAGE_SIZE, parseFilters } from "@/lib/finance/filters";
import { formatCents } from "@/lib/finance/money";
import { financePeriods } from "@/lib/finance/periods";
import { salaryFor, sumByMonth } from "@/lib/finance/income";
import { getAccounts, getCategories, getIncomeData, listTransactions } from "@/lib/finance/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Gastos · Finanzas" };

const shiftMonth = (month: string, delta: number) => {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parsed = parseFilters(await searchParams);
  const current = financePeriods(new Date()).monthKey;
  const month = parsed.mes ?? current;
  const page = parsed.pagina ?? 1;
  // Filtros de la tabla; el mes y la página van aparte
  const filters = { ...parsed, mes: month, pagina: undefined };
  const filtered = Boolean(filters.q || filters.categoria || filters.cuenta || filters.tipo);
  const { from, to } = monthBounds(month);
  const supabase = await createClient();

  const [accounts, categories, cashflow, spending, list, incomeData] = await Promise.all([
    getAccounts(),
    getCategories(),
    supabase.rpc("monthly_cashflow", { p_from: from, p_to: to }),
    supabase.rpc("category_spending", { p_from: from, p_to: to }),
    listTransactions({ ...filters, pagina: page }),
    getIncomeData(from),
  ]);

  const monthName = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${month}-01T00:00:00Z`),
  );
  const income = cashflow.data?.[0]?.income_cents ?? 0;
  const expense = cashflow.data?.[0]?.expense_cents ?? 0;
  const saving = income - expense;
  const salary = salaryFor(month, sumByMonth(incomeData.salary), incomeData.fallbackSalaryCents, current);
  const left = salary.cents - expense;
  const labels = categoryLabels(categories);
  const groups = categoryOptions(categories);
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const activeAccounts = accounts.filter((a) => !a.archived).map((a) => ({ id: a.id, name: a.name }));
  const pages = Math.max(1, Math.ceil(list.total / PAGE_SIZE));
  const base = `/finanzas/gastos`;

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <nav aria-label="Mes" className="bg-surface border-border flex items-center gap-1 rounded-full border p-1">
          <Link
            href={filtersHref(base, filters, { mes: shiftMonth(month, -1) })}
            className="text-muted hover:text-text rounded-full px-3 py-1.5 text-sm"
            aria-label="Mes anterior"
          >
            ←
          </Link>
          <span className="px-2 text-sm font-semibold first-letter:uppercase">{monthName}</span>
          {month < current ? (
            <Link
              href={filtersHref(base, filters, { mes: shiftMonth(month, 1) })}
              className="text-muted hover:text-text rounded-full px-3 py-1.5 text-sm"
              aria-label="Mes siguiente"
            >
              →
            </Link>
          ) : (
            <span className="text-border-strong px-3 py-1.5 text-sm" aria-hidden="true">
              →
            </span>
          )}
        </nav>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Link href="/finanzas/movimientos" className={buttonClass.secondary}>
            Buscar en todos
          </Link>
          <SyncStatementsButton />
        </div>
      </div>

      <section aria-label="Salario frente a gastos" className="grid gap-3.5 sm:grid-cols-3">
        <Tile className="flex flex-col items-center justify-center p-5 text-center">
          <p className="text-muted text-sm">Salario del mes</p>
          <p className="font-display mt-1 text-3xl font-extrabold tabular-nums">
            {salary.source === "none" ? "—" : formatCents(salary.cents)}
          </p>
          <p className="text-muted mt-1 text-xs">
            {salary.source === "detected"
              ? "Nóminas de los extractos"
              : salary.source === "fallback"
                ? "Aún sin nómina: tu salario de Ajustes"
                : "Sin nómina este mes"}
          </p>
        </Tile>
        <Tile className="flex flex-col items-center justify-center p-5 text-center">
          <p className="text-muted text-sm">Gastado</p>
          <p className="font-display text-expense mt-1 text-3xl font-extrabold tabular-nums">{formatCents(expense)}</p>
          <p className="text-muted mt-1 text-xs tabular-nums">
            {salary.cents > 0 ? `${Math.round((expense / salary.cents) * 100)} % del salario` : "—"}
          </p>
        </Tile>
        <Tile className="flex flex-col items-center justify-center p-5 text-center">
          <p className="text-muted text-sm">Te queda</p>
          <p
            className={clsx(
              "font-display mt-1 text-3xl font-extrabold tabular-nums",
              salary.cents > 0 && (left >= 0 ? "text-finance" : "text-expense"),
            )}
          >
            {salary.cents > 0 ? formatCents(left, "EUR", { signed: true }) : "—"}
          </p>
          <p className="text-muted mt-1 text-xs tabular-nums">
            Ingresos totales {formatCents(income)} · ahorro{" "}
            {income > 0 ? `${Math.round((saving / income) * 100)} %` : "—"}
          </p>
        </Tile>
      </section>

      <div className="grid gap-3.5 lg:grid-cols-5">
        <Tile className="lg:col-span-2">
          <TileTitle dot="bg-expense">Por categoría</TileTitle>
          <div className="mt-4">
            {spending.data?.length ? (
              <CategoryBars
                currency="EUR"
                items={spending.data.slice(0, 10).map((s) => ({
                  id: s.category_id ?? "sin",
                  label: s.category_id ? (labels.get(s.category_id) ?? "—") : "Sin categoría",
                  cents: s.spent_cents,
                  href: `/finanzas/gastos?mes=${month}&tipo=gastos&categoria=${s.category_id ?? "sin"}`,
                }))}
              />
            ) : (
              <EmptyState>Sin gastos este mes.</EmptyState>
            )}
          </div>
        </Tile>
        <Tile className="lg:col-span-3">
          {activeAccounts.length > 0 && (
            <details>
              <summary className="cursor-pointer font-semibold select-none">Añadir gasto o ingreso</summary>
              <div className="mt-4">
                <TransactionForm accounts={activeAccounts} categoryGroups={groups} today={dayKey(new Date())} />
              </div>
            </details>
          )}
          <div className="mt-4 flex items-center gap-3">
            <TileTitle>Movimientos del mes</TileTitle>
            <span className="text-muted text-sm tabular-nums">{list.total}</span>
          </div>
          <div className="mt-4">
            <TransactionFilters filters={filters} accounts={activeAccounts} categoryGroups={groups} />
          </div>
          <div className="mt-3">
            {list.rows.length ? (
              <TransactionsTable
                key={JSON.stringify({ ...filters, page })}
                accounts={activeAccounts}
                categoryGroups={groups}
                today={dayKey(new Date())}
                rows={list.rows.map((r) => ({
                  ...r,
                  accountName: accountById.get(r.account_id)?.name ?? "—",
                  currency: accountById.get(r.account_id)?.currency ?? "EUR",
                  categoryLabel: r.category_id ? (labels.get(r.category_id) ?? null) : null,
                }))}
              />
            ) : (
              <EmptyState>
                {!accounts.length
                  ? "Crea una cuenta en Ajustes para empezar."
                  : filtered
                    ? "Ningún movimiento con estos filtros."
                    : "No hay movimientos este mes."}
              </EmptyState>
            )}
          </div>
          {pages > 1 && (
            <nav aria-label="Páginas" className="mt-4 flex items-center justify-between text-sm">
              {page > 1 ? (
                <Link href={filtersHref(base, filters, { pagina: page - 1 })} className={buttonClass.secondary}>
                  Anteriores
                </Link>
              ) : (
                <span />
              )}
              <span className="text-muted">
                Página {page} de {pages}
              </span>
              {page < pages ? (
                <Link href={filtersHref(base, filters, { pagina: page + 1 })} className={buttonClass.secondary}>
                  Siguientes
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </Tile>
      </div>
    </>
  );
}
