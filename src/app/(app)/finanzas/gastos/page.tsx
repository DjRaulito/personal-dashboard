import type { Metadata } from "next";
import Link from "next/link";
import { clsx } from "clsx";
import { CategoryBars } from "@/components/finance/charts";
import { TransactionForm } from "@/components/finance/transaction-form";
import { TransactionsTable } from "@/components/finance/transactions-table";
import { buttonClass, EmptyState, Tile, TileTitle } from "@/components/ui";
import { dayKey } from "@/lib/datetime";
import { categoryLabels, categoryOptions } from "@/lib/finance/categories";
import { filtersHref, monthBounds, PAGE_SIZE } from "@/lib/finance/filters";
import { formatCents } from "@/lib/finance/money";
import { financePeriods } from "@/lib/finance/periods";
import { getAccounts, getCategories, listTransactions } from "@/lib/finance/server";
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
  searchParams: Promise<{ mes?: string; pagina?: string }>;
}) {
  const sp = await searchParams;
  const current = financePeriods(new Date()).monthKey;
  const month = sp.mes && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : current;
  const page = Math.max(1, Number(sp.pagina) || 1);
  const { from, to } = monthBounds(month);
  const supabase = await createClient();

  const [accounts, categories, cashflow, spending, list] = await Promise.all([
    getAccounts(),
    getCategories(),
    supabase.rpc("monthly_cashflow", { p_from: from, p_to: to }),
    supabase.rpc("category_spending", { p_from: from, p_to: to }),
    listTransactions({ mes: month, pagina: page }),
  ]);

  const monthName = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${month}-01T00:00:00Z`),
  );
  const income = cashflow.data?.[0]?.income_cents ?? 0;
  const expense = cashflow.data?.[0]?.expense_cents ?? 0;
  const saving = income - expense;
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
            href={`${base}?mes=${shiftMonth(month, -1)}`}
            className="text-muted hover:text-text rounded-full px-3 py-1.5 text-sm"
            aria-label="Mes anterior"
          >
            ←
          </Link>
          <span className="px-2 text-sm font-semibold first-letter:uppercase">{monthName}</span>
          {month < current ? (
            <Link
              href={`${base}?mes=${shiftMonth(month, 1)}`}
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
        <div className="ml-auto flex flex-wrap gap-2">
          <Link href="/finanzas/importar" className={buttonClass.secondary}>
            Importar extracto
          </Link>
          <Link href="/finanzas/movimientos" className={buttonClass.secondary}>
            Buscar en todos
          </Link>
        </div>
      </div>

      <section aria-label="Resumen del mes" className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <Tile>
          <p className="text-muted text-sm">Gastos</p>
          <p className="font-display mt-3 text-3xl font-extrabold tracking-tight">{formatCents(expense)}</p>
        </Tile>
        <Tile>
          <p className="text-muted text-sm">Ingresos</p>
          <p className="font-display mt-3 text-3xl font-extrabold tracking-tight">{formatCents(income)}</p>
        </Tile>
        <Tile>
          <p className="text-muted text-sm">Ahorro</p>
          <p className={clsx("font-display mt-3 text-3xl font-extrabold tracking-tight", saving < 0 && "text-expense")}>
            {formatCents(saving, "EUR", { signed: true })}
          </p>
        </Tile>
        <Tile>
          <p className="text-muted text-sm">Tasa de ahorro</p>
          <p className="font-display mt-3 text-3xl font-extrabold tracking-tight">
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
                  href: `/finanzas/movimientos?mes=${month}&tipo=gastos&categoria=${s.category_id ?? "sin"}`,
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
            <span className="text-muted text-sm">{list.total}</span>
          </div>
          <div className="mt-4">
            {list.rows.length ? (
              <TransactionsTable
                key={`${month}-${page}`}
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
                {accounts.length ? "No hay movimientos este mes." : "Crea una cuenta en Ajustes para empezar."}
              </EmptyState>
            )}
          </div>
          {pages > 1 && (
            <nav aria-label="Páginas" className="mt-4 flex items-center justify-between text-sm">
              {page > 1 ? (
                <Link href={filtersHref(base, { mes: month }, { pagina: page - 1 })} className={buttonClass.secondary}>
                  Anteriores
                </Link>
              ) : (
                <span />
              )}
              <span className="text-muted">
                Página {page} de {pages}
              </span>
              {page < pages ? (
                <Link href={filtersHref(base, { mes: month }, { pagina: page + 1 })} className={buttonClass.secondary}>
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
