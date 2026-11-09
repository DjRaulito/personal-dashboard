import type { Metadata } from "next";
import Link from "next/link";
import { TransactionForm } from "@/components/finance/transaction-form";
import { TransactionsTable } from "@/components/finance/transactions-table";
import { CategoryOptions } from "@/components/finance/category-select";
import { BackLink, buttonClass, EmptyState, inputClass, Tile, TileTitle } from "@/components/ui";
import { dayKey } from "@/lib/datetime";
import { categoryLabels, categoryOptions } from "@/lib/finance/categories";
import { filtersHref, PAGE_SIZE, parseFilters } from "@/lib/finance/filters";
import { getAccounts, getCategories, listTransactions } from "@/lib/finance/server";

export const metadata: Metadata = { title: "Movimientos · Finanzas" };

const BASE = "/finanzas/movimientos";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseFilters(await searchParams);
  const [accounts, categories, { rows, total, page }] = await Promise.all([
    getAccounts(),
    getCategories(),
    listTransactions(filters),
  ]);
  const labels = categoryLabels(categories);
  const groups = categoryOptions(categories);
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const activeAccounts = accounts.filter((a) => !a.archived).map((a) => ({ id: a.id, name: a.name }));
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const today = dayKey(new Date());
  const hasFilters = Object.entries(filters).some(([k, v]) => k !== "pagina" && v !== undefined);

  if (accounts.length === 0) {
    return (
      <Tile>
        <EmptyState>
          Primero crea una cuenta en{" "}
          <Link href="/finanzas/cuentas" className="text-text underline">
            Cuentas
          </Link>
          .
        </EmptyState>
      </Tile>
    );
  }

  return (
    <>
      <BackLink href="/finanzas/gastos">Gastos</BackLink>
      <Tile>
        <details>
          <summary className="cursor-pointer font-semibold select-none">Añadir movimiento</summary>
          <div className="mt-4">
            <TransactionForm accounts={activeAccounts} categoryGroups={groups} today={today} />
          </div>
        </details>
      </Tile>

      <Tile>
        <div className="flex flex-wrap items-center gap-3">
          <TileTitle>Movimientos</TileTitle>
          <span className="text-muted text-sm">{total.toLocaleString("es-ES")} en total</span>
        </div>

        <form method="get" action={BASE} className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
          <input
            name="q"
            type="search"
            defaultValue={filters.q}
            placeholder="Buscar concepto…"
            aria-label="Buscar concepto"
            className={`${inputClass} lg:col-span-2`}
          />
          <select name="cuenta" defaultValue={filters.cuenta ?? ""} aria-label="Cuenta" className={inputClass}>
            <option value="">Todas las cuentas</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <select name="categoria" defaultValue={filters.categoria ?? ""} aria-label="Categoría" className={inputClass}>
            <option value="">Todas las categorías</option>
            <option value="sin">Sin categoría</option>
            <CategoryOptions groups={groups} />
          </select>
          <input name="mes" type="month" defaultValue={filters.mes} aria-label="Mes" className={inputClass} />
          <select name="tipo" defaultValue={filters.tipo ?? ""} aria-label="Tipo" className={inputClass}>
            <option value="">Gastos e ingresos</option>
            <option value="gastos">Solo gastos</option>
            <option value="ingresos">Solo ingresos</option>
          </select>
          <div className="flex gap-2 sm:col-span-2 lg:col-span-6">
            <button type="submit" className={buttonClass.secondary}>
              Filtrar
            </button>
            {hasFilters && (
              <Link href={BASE} className={buttonClass.secondary}>
                Quitar filtros
              </Link>
            )}
          </div>
        </form>

        <div className="mt-5">
          {rows.length === 0 ? (
            <EmptyState>
              {hasFilters
                ? "Ningún movimiento con estos filtros."
                : "Aún no hay movimientos. Añade uno o importa un extracto."}
            </EmptyState>
          ) : (
            <TransactionsTable
              key={JSON.stringify(filters)}
              accounts={activeAccounts}
              categoryGroups={groups}
              today={today}
              rows={rows.map((r) => ({
                ...r,
                accountName: accountById.get(r.account_id)?.name ?? "—",
                currency: accountById.get(r.account_id)?.currency ?? "EUR",
                categoryLabel: r.category_id ? (labels.get(r.category_id) ?? null) : null,
              }))}
            />
          )}
        </div>

        {pages > 1 && (
          <nav aria-label="Páginas" className="mt-4 flex items-center justify-between text-sm">
            {page > 1 ? (
              <Link href={filtersHref(BASE, filters, { pagina: page - 1 })} className={buttonClass.secondary}>
                Anteriores
              </Link>
            ) : (
              <span />
            )}
            <span className="text-muted">
              Página {page} de {pages}
            </span>
            {page < pages ? (
              <Link href={filtersHref(BASE, filters, { pagina: page + 1 })} className={buttonClass.secondary}>
                Siguientes
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </Tile>
    </>
  );
}
