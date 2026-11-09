import type { Metadata } from "next";
import { clsx } from "clsx";
import { CashflowChart, CategoryBars } from "@/components/finance/charts";
import { EmptyState, Tile, TileTitle } from "@/components/ui";
import { categoryLabels } from "@/lib/finance/categories";
import { formatCents } from "@/lib/finance/money";
import { financePeriods, monthsBetween } from "@/lib/finance/periods";
import { getCategories } from "@/lib/finance/server";
import { computePositions } from "@/lib/investments/engine";
import { getPortfolio } from "@/lib/investments/server";
import { yearlyStats } from "@/lib/investments/view";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Métricas · Finanzas" };

const eur = (v: number, signed = false) => formatCents(Math.round(v * 100), "EUR", { signed });
const pct = (v: number | null) =>
  v == null
    ? "—"
    : `${v > 0 ? "+" : ""}${(v * 100).toLocaleString("es-ES", { maximumFractionDigits: 2, minimumFractionDigits: 2 })} %`;
const tone = (v: number | null) => (v == null || Math.abs(v) < 1e-9 ? "" : v > 0 ? "text-finance" : "text-expense");

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-surface-2 rounded-inner px-4 py-3">
      <p className="text-muted text-xs">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-muted text-xs">{hint}</p>}
    </div>
  );
}

export default async function MetricsPage() {
  const p = financePeriods(new Date());
  const supabase = await createClient();
  // Los 12 meses completos anteriores al actual
  const [categories, cashflow, spending, pf] = await Promise.all([
    getCategories(),
    supabase.rpc("monthly_cashflow", { p_from: p.windowStart, p_to: p.nextMonthStart }),
    supabase.rpc("category_spending", { p_from: p.windowStart, p_to: p.monthStart }),
    getPortfolio(),
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

  const years = yearlyStats(pf.input, pf.series, (upTo) => computePositions(pf.input, upTo));
  const total = pf.returns.find((r) => r.period === "TOTAL");
  const first = pf.series[0]?.date;
  const yearsElapsed = first ? (Date.parse(pf.today) - Date.parse(first)) / (365.25 * 86400000) : 0;
  const annualized =
    total?.returnPct != null && yearsElapsed >= 1 ? (1 + total.returnPct) ** (1 / yearsElapsed) - 1 : null;
  const last = pf.series.at(-1);

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

      <div className="grid gap-3.5 lg:grid-cols-5">
        <Tile className="lg:col-span-2">
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

        <Tile className="lg:col-span-3">
          <TileTitle>Inversiones</TileTitle>
          {years.length ? (
            <>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <Stat label="Aportado neto" value={eur(last?.investedEur ?? 0)} />
                <Stat label="Valor actual" value={eur(last?.valueEur ?? 0)} />
                <Stat label="Ganancia total" value={eur(total?.pnlEur ?? 0, true)} />
                <Stat
                  label="Rentabilidad anualizada"
                  value={pct(annualized)}
                  hint={annualized == null ? "Necesita más de un año" : `Total ${pct(total?.returnPct ?? null)}`}
                />
              </div>
              <div className="relative mt-5 overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="text-muted text-left">
                    <tr>
                      <th className="py-2 font-medium">Año</th>
                      <th className="py-2 text-right font-medium">Rentabilidad</th>
                      <th className="py-2 text-right font-medium">Ganancia</th>
                      <th className="py-2 text-right font-medium">Aportado</th>
                      <th className="py-2 text-right font-medium">Plusvalías realizadas</th>
                      <th className="py-2 text-right font-medium">Dividendos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {years.map((y) => (
                      <tr key={y.year} className="border-border border-t">
                        <td className="py-2 font-medium">{y.year}</td>
                        <td className={clsx("py-2 text-right tabular-nums", tone(y.returnPct))}>{pct(y.returnPct)}</td>
                        <td className={clsx("py-2 text-right tabular-nums", tone(y.pnlEur))}>{eur(y.pnlEur, true)}</td>
                        <td className="text-muted py-2 text-right tabular-nums">{eur(y.contributedEur, true)}</td>
                        <td className={clsx("py-2 text-right tabular-nums", tone(y.realizedEur))}>
                          {eur(y.realizedEur, true)}
                        </td>
                        <td className="py-2 text-right tabular-nums">{eur(y.dividendsEur)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-muted mt-3 text-xs">
                Plusvalías realizadas con FIFO (como Hacienda). Los traspasos entre fondos cuentan aquí como venta,
                aunque fiscalmente no tributan.
              </p>
            </>
          ) : (
            <EmptyState>Importa tu cartera para ver las métricas de inversión.</EmptyState>
          )}
        </Tile>
      </div>
    </>
  );
}
