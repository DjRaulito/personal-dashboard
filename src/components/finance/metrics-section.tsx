import { CashflowChart, CategoryBars } from "@/components/finance/charts";
import { EmptyState, Tile, TileTitle } from "@/components/ui";
import { categoryLabels } from "@/lib/finance/categories";
import { formatCents } from "@/lib/finance/money";
import { financePeriods, monthsBetween } from "@/lib/finance/periods";
import { getCategories } from "@/lib/finance/server";
import { createClient } from "@/lib/supabase/server";

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-surface-2 rounded-inner px-4 py-3">
      <p className="text-muted text-xs">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-muted text-xs">{hint}</p>}
    </div>
  );
}

export async function MetricsSection() {
  const p = financePeriods(new Date());
  const supabase = await createClient();
  // Los 12 meses completos anteriores al actual
  const [categories, cashflow, spending] = await Promise.all([
    getCategories(),
    supabase.rpc("monthly_cashflow", { p_from: p.windowStart, p_to: p.nextMonthStart }),
    supabase.rpc("category_spending", { p_from: p.windowStart, p_to: p.monthStart }),
  ]);

  const byMonth = new Map((cashflow.data ?? []).map((r) => [r.month, r]));
  const months = monthsBetween(p.windowStart, p.nextMonthStart).map((month) => ({
    month,
    income: byMonth.get(month)?.income_cents ?? 0,
    expense: byMonth.get(month)?.expense_cents ?? 0,
  }));
  const complete = months.slice(0, -1).filter((m) => m.income || m.expense);
  const n = complete.length || 1;
  const avgIncome = complete.reduce((s, m) => s + m.income, 0) / n;
  const avgExpense = complete.reduce((s, m) => s + m.expense, 0) / n;
  const savingRate = avgIncome > 0 ? (avgIncome - avgExpense) / avgIncome : null;
  const labels = categoryLabels(categories);

  return (
    <>
      <Tile>
        <TileTitle>Ahorro · últimos 12 meses</TileTitle>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <Stat label="Ingreso medio mensual" value={formatCents(Math.round(avgIncome))} />
          <Stat label="Gasto medio mensual" value={formatCents(Math.round(avgExpense))} />
          <Stat
            label="Tasa de ahorro media"
            value={savingRate == null ? "—" : `${Math.round(savingRate * 100)} %`}
            hint={`${complete.length} meses con datos`}
          />
        </div>
        <div className="mt-6">
          {complete.length ? (
            <CashflowChart data={months} currency="EUR" />
          ) : (
            <EmptyState>Importa tus extractos para ver la evolución del ahorro.</EmptyState>
          )}
        </div>
      </Tile>

      <Tile>
        <TileTitle dot="bg-expense">Gasto medio al mes por categoría</TileTitle>
        <div className="mt-4">
          {spending.data?.length ? (
            <CategoryBars
              currency="EUR"
              items={spending.data.slice(0, 10).map((s) => ({
                id: s.category_id ?? "sin",
                label: s.category_id ? (labels.get(s.category_id) ?? "—") : "Sin categoría",
                cents: Math.round(s.spent_cents / n),
                href: `/finanzas/movimientos?categoria=${s.category_id ?? "sin"}&tipo=gastos`,
              }))}
            />
          ) : (
            <EmptyState>Sin datos de gastos.</EmptyState>
          )}
        </div>
      </Tile>
    </>
  );
}
