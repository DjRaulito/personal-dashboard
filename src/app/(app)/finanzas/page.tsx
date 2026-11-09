import type { Metadata } from "next";
import Link from "next/link";
import { CashflowChart, CategoryBars, NetWorthChart } from "@/components/finance/charts";
import { buttonClass, EmptyState, Tile, TileTitle } from "@/components/ui";
import { ACCOUNT_TYPE_LABELS } from "@/lib/finance/accounts";
import { categoryLabels } from "@/lib/finance/categories";
import { formatCents } from "@/lib/finance/money";
import { financePeriods, monthsBetween } from "@/lib/finance/periods";
import { getAccounts, getCategories } from "@/lib/finance/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Finanzas · Personal Dashboard" };

export default async function FinanceOverview() {
  const p = financePeriods(new Date());
  const supabase = await createClient();
  const [accounts, categories, cashflow, spending, netWorth, uncategorized] = await Promise.all([
    getAccounts(),
    getCategories(),
    supabase.rpc("monthly_cashflow", { p_from: p.windowStart, p_to: p.nextMonthStart }),
    supabase.rpc("category_spending", { p_from: p.monthStart, p_to: p.nextMonthStart }),
    supabase.rpc("net_worth_by_month", { p_from: p.windowStart, p_to: p.monthStart }),
    supabase.from("transactions").select("id", { count: "exact", head: true }).is("category_id", null),
  ]);

  if (accounts.length === 0) {
    return (
      <Tile>
        <EmptyState>
          Empieza creando tus cuentas (banco, tarjeta, efectivo, broker) y luego importa un extracto.
        </EmptyState>
        <div className="flex justify-center gap-2">
          <Link href="/finanzas/cuentas" className={buttonClass.primary}>
            Crear cuenta
          </Link>
        </div>
      </Tile>
    );
  }

  const currency = accounts[0].currency;
  const netWorthNow = accounts.reduce((sum, a) => sum + a.balance_cents, 0);
  const byMonth = new Map((cashflow.data ?? []).map((r) => [r.month, r]));
  const months = monthsBetween(p.windowStart, p.nextMonthStart).map((month) => ({
    month,
    income: byMonth.get(month)?.income_cents ?? 0,
    expense: byMonth.get(month)?.expense_cents ?? 0,
  }));
  const current = months[months.length - 1];
  const labels = categoryLabels(categories);
  const categoryItems = (spending.data ?? []).slice(0, 8).map((s) => ({
    id: s.category_id ?? "sin",
    label: s.category_id ? (labels.get(s.category_id) ?? "—") : "Sin categoría",
    cents: s.spent_cents,
    href: `/finanzas/movimientos?mes=${p.monthKey}&tipo=gastos&categoria=${s.category_id ?? "sin"}`,
  }));
  // El último punto del patrimonio es el saldo actual
  const netWorthSeries = [
    ...(netWorth.data ?? []).map((r) => ({ month: r.month, cents: r.net_worth_cents })),
    { month: p.monthStart, cents: netWorthNow },
  ];
  const hasHistory = months.some((m) => m.income || m.expense);
  const monthName = new Intl.DateTimeFormat("es-ES", { month: "long", timeZone: "UTC" }).format(
    new Date(`${p.monthStart}T00:00:00Z`),
  );

  return (
    <>
      <section aria-label="Indicadores" className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-tile bg-finance text-ink p-6 sm:col-span-2">
          <p className="text-sm font-semibold">Patrimonio neto</p>
          <p className="font-display mt-3 text-5xl leading-none font-extrabold tracking-tight">
            {formatCents(netWorthNow, currency)}
          </p>
          <p className="mt-3 text-sm font-medium">{accounts.filter((a) => !a.archived).length} cuentas activas</p>
        </div>
        <Tile>
          <p className="text-muted text-sm first-letter:uppercase">Gastos de {monthName}</p>
          <p className="font-display mt-3 text-3xl font-extrabold tracking-tight">
            {formatCents(current.expense, currency)}
          </p>
          <p className="text-muted mt-1 text-sm">Ingresos {formatCents(current.income, currency)}</p>
        </Tile>
        <Tile>
          <p className="text-muted text-sm">Sin categoría</p>
          <p className="font-display mt-3 text-3xl font-extrabold tracking-tight">
            {(uncategorized.count ?? 0).toLocaleString("es-ES")}
          </p>
          <Link
            href="/finanzas/movimientos?categoria=sin"
            className="text-muted hover:text-text mt-1 inline-block text-sm underline-offset-2 hover:underline"
          >
            Revisar
          </Link>
        </Tile>
      </section>

      <div className="grid gap-3.5 lg:grid-cols-5">
        <Tile className="lg:col-span-3">
          <TileTitle>Ingresos y gastos · 12 meses</TileTitle>
          <div className="mt-5">
            {hasHistory ? (
              <CashflowChart data={months} currency={currency} />
            ) : (
              <EmptyState>Aún no hay movimientos. Importa un extracto para ver la evolución.</EmptyState>
            )}
          </div>
        </Tile>
        <Tile className="lg:col-span-2">
          <TileTitle dot="bg-expense">
            <span className="first-letter:uppercase">Gasto por categoría · {monthName}</span>
          </TileTitle>
          <div className="mt-4">
            {categoryItems.length > 0 ? (
              <CategoryBars items={categoryItems} currency={currency} />
            ) : (
              <EmptyState>Sin gastos este mes.</EmptyState>
            )}
          </div>
        </Tile>
      </div>

      <div className="grid gap-3.5 lg:grid-cols-5">
        <Tile className="lg:col-span-3">
          <TileTitle>Patrimonio · 12 meses</TileTitle>
          <div className="mt-5">
            <NetWorthChart data={netWorthSeries} currency={currency} />
          </div>
        </Tile>
        <Tile className="lg:col-span-2">
          <TileTitle>Cuentas</TileTitle>
          <ul className="mt-4 flex flex-col gap-2">
            {accounts
              .filter((a) => !a.archived)
              .map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/finanzas/movimientos?cuenta=${a.id}`}
                    className="bg-surface-2 rounded-inner hover:bg-border flex items-center justify-between gap-3 px-4 py-3 transition-colors duration-200"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{a.name}</span>
                      <span className="text-muted block text-xs">{ACCOUNT_TYPE_LABELS[a.type]}</span>
                    </span>
                    <span className="font-semibold tabular-nums">{formatCents(a.balance_cents, a.currency)}</span>
                  </Link>
                </li>
              ))}
          </ul>
        </Tile>
      </div>
    </>
  );
}
