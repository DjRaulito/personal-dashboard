import type { Metadata } from "next";
import { clsx } from "clsx";
import {
  AddSuggestion,
  BudgetActions,
  BudgetForm,
  GoalActions,
  GoalForm,
  RecurringActions,
  RecurringForm,
} from "@/components/finance/planning";
import { EmptyState, Tile, TileTitle } from "@/components/ui";
import { dayKey } from "@/lib/datetime";
import { categoryLabels, categoryOptions } from "@/lib/finance/categories";
import { formatCents } from "@/lib/finance/money";
import { financePeriods } from "@/lib/finance/periods";
import {
  addDays,
  budgetStatus,
  detectRecurring,
  FREQUENCY_LABELS,
  goalProgress,
  merchantKey,
  monthElapsed,
  monthlyEquivalent,
  upcomingOccurrences,
  type BudgetState,
} from "@/lib/finance/planning";
import { getPlanning } from "@/lib/finance/planning-server";
import { getAccounts, getCategories } from "@/lib/finance/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Plan · Finanzas" };

const BAR: Record<BudgetState, string> = { ok: "bg-finance", warn: "bg-attention", over: "bg-expense" };

const shortDate = (d: string) =>
  new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${d}T00:00:00Z`),
  );

function Progress({ ratio, className, label }: { ratio: number; className: string; label: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, ratio)) * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className="bg-surface-2 mt-2 h-2.5 overflow-hidden rounded-full"
    >
      <div className={clsx("h-full rounded-full", className)} style={{ width: `${Math.max(pct, 1.5)}%` }} />
    </div>
  );
}

export default async function PlanPage() {
  const now = new Date();
  const today = dayKey(now);
  const p = financePeriods(now);
  const threeMonthsAgo = financePeriods(now, 4).windowStart;
  const supabase = await createClient();

  const [accounts, categories, planning, spending, history] = await Promise.all([
    getAccounts(),
    getCategories(),
    getPlanning(today),
    supabase.rpc("category_spending", { p_from: p.monthStart, p_to: p.nextMonthStart }),
    supabase.rpc("category_spending", { p_from: threeMonthsAgo, p_to: p.monthStart }),
  ]);

  const labels = categoryLabels(categories);
  const groups = categoryOptions(categories);
  const activeAccounts = accounts.filter((a) => !a.archived).map((a) => ({ id: a.id, name: a.name }));
  const balanceById = new Map(accounts.map((a) => [a.id, a.balance_cents]));
  const spentBy = new Map((spending.data ?? []).map((s) => [s.category_id, s.spent_cents]));
  const avgBy = new Map((history.data ?? []).map((s) => [s.category_id, Math.round(s.spent_cents / 3)]));

  // Presupuestos (sobre categorías principales de gasto, como el gasto por categoría)
  const elapsed = monthElapsed(today, p.monthKey);
  const budgets = planning.budgets
    .map((b) => ({
      ...b,
      label: labels.get(b.category_id) ?? "—",
      spent: spentBy.get(b.category_id) ?? 0,
      avg: avgBy.get(b.category_id) ?? 0,
    }))
    .map((b) => ({ ...b, status: budgetStatus(b.amount_cents, b.spent, elapsed) }))
    .sort((a, b) => b.status.ratio - a.status.ratio);
  const budgeted = new Set(budgets.map((b) => b.category_id));
  const budgetable = categories
    .filter((c) => c.kind === "expense" && !c.parent_id && !budgeted.has(c.id))
    .map((c) => {
      const avg = avgBy.get(c.id);
      return { id: c.id, label: avg ? `${c.name} (media ${formatCents(avg)})` : c.name };
    });
  const totalBudget = budgets.reduce((s, b) => s + b.amount_cents, 0);
  const totalBudgetSpent = budgets.reduce((s, b) => s + b.spent, 0);

  // Pagos recurrentes
  const active = planning.recurring.filter((r) => r.active);
  const upcoming = upcomingOccurrences(active, today, addDays(today, 30));
  const fixedOut = -active
    .filter((r) => r.amount_cents < 0)
    .reduce((s, r) => s + monthlyEquivalent(r.amount_cents, r.frequency), 0);
  const fixedIn = active
    .filter((r) => r.amount_cents > 0)
    .reduce((s, r) => s + monthlyEquivalent(r.amount_cents, r.frequency), 0);
  const known = planning.recurring.map((r) => merchantKey(r.match_pattern ?? r.name)).filter(Boolean);
  const suggestions = detectRecurring(planning.transactions, today)
    .filter((s) => !known.some((k) => k && (s.pattern.includes(k) || k.includes(s.pattern))))
    .slice(0, 12);

  // Huchas
  const goals = planning.goals.map((g) => {
    const saved = g.account_id ? Math.max(0, balanceById.get(g.account_id) ?? 0) : g.saved_cents;
    return { ...g, saved, progress: goalProgress(g.target_cents, saved, g.target_date, today) };
  });
  const openGoals = goals.filter((g) => !g.archived);
  const archivedGoals = goals.filter((g) => g.archived);
  const totalSaved = openGoals.reduce((s, g) => s + g.saved, 0);
  const formProps = { accounts: activeAccounts, categoryGroups: groups, today };

  return (
    <>
      <section aria-label="Resumen del plan" className="grid gap-3.5 sm:grid-cols-3">
        <Tile>
          <p className="text-muted text-sm">Presupuesto del mes</p>
          <p className="font-display mt-3 text-3xl font-extrabold tracking-tight tabular-nums">
            {totalBudget ? formatCents(totalBudget - totalBudgetSpent) : "—"}
          </p>
          <p className="text-muted mt-1 text-sm">
            {totalBudget
              ? `${totalBudgetSpent > totalBudget ? "por encima" : "disponibles"} de ${formatCents(totalBudget)}`
              : "Sin presupuestos"}
          </p>
        </Tile>
        <Tile>
          <p className="text-muted text-sm">Gastos fijos al mes</p>
          <p className="font-display mt-3 text-3xl font-extrabold tracking-tight tabular-nums">
            {active.length ? formatCents(fixedOut) : "—"}
          </p>
          <p className="text-muted mt-1 text-sm">
            {fixedIn ? `Cobros fijos: ${formatCents(fixedIn)}` : `${active.length} pagos recurrentes`}
          </p>
        </Tile>
        <Tile>
          <p className="text-muted text-sm">En huchas</p>
          <p className="font-display mt-3 text-3xl font-extrabold tracking-tight tabular-nums">
            {openGoals.length ? formatCents(totalSaved) : "—"}
          </p>
          <p className="text-muted mt-1 text-sm">{openGoals.length ? `${openGoals.length} objetivos` : "Sin huchas"}</p>
        </Tile>
      </section>

      <div className="grid gap-3.5 lg:grid-cols-2">
        <Tile>
          <TileTitle dot="bg-expense">Presupuestos de este mes</TileTitle>
          <p className="text-muted mt-1 text-sm">
            Límite mensual por categoría. Aviso en amarillo si vas por delante del ritmo del mes.
          </p>
          {budgets.length ? (
            <ul className="mt-4 flex flex-col gap-4">
              {budgets.map((b) => (
                <li key={b.id} className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="truncate font-medium">{b.label}</span>
                      <span className="text-muted shrink-0 tabular-nums">
                        {formatCents(b.spent)} / {formatCents(b.amount_cents)}
                      </span>
                    </p>
                    <Progress ratio={b.status.ratio} className={BAR[b.status.state]} label={`Gasto en ${b.label}`} />
                    <p
                      className={clsx(
                        "mt-1.5 text-xs",
                        b.status.state === "over"
                          ? "text-expense"
                          : b.status.state === "warn"
                            ? "text-attention"
                            : "text-muted",
                      )}
                    >
                      {b.status.remaining >= 0
                        ? `Quedan ${formatCents(b.status.remaining)}`
                        : `Te pasas ${formatCents(-b.status.remaining)}`}
                      {b.status.projected !== null &&
                        elapsed < 1 &&
                        b.status.projected > b.amount_cents &&
                        ` · a este ritmo, ${formatCents(b.status.projected)}`}
                      {b.avg > 0 && ` · media 3 meses ${formatCents(b.avg)}`}
                    </p>
                  </div>
                  <BudgetActions budget={b} label={b.label} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>Aún no tienes presupuestos.</EmptyState>
          )}
          {budgetable.length > 0 && (
            <div className="border-border mt-6 border-t pt-4">
              <BudgetForm categories={budgetable} />
            </div>
          )}
        </Tile>

        <Tile>
          <TileTitle dot="bg-attention">Próximos 30 días</TileTitle>
          {upcoming.length ? (
            <ul className="mt-4 flex flex-col">
              {upcoming.map(({ item, date }) => {
                const overdue = date < today;
                return (
                  <li
                    key={`${item.id}-${date}`}
                    className="border-border flex items-center gap-3 border-b py-2.5 text-sm last:border-0"
                  >
                    <span
                      className={clsx("w-16 shrink-0 tabular-nums", overdue ? "text-attention" : "text-muted")}
                      title={overdue ? "Vencido sin marcar" : undefined}
                    >
                      {shortDate(date)}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {item.name}
                      {overdue && <span className="text-attention ml-2 text-xs">vencido</span>}
                    </span>
                    <span className={clsx("shrink-0 tabular-nums", item.amount_cents > 0 && "text-finance")}>
                      {formatCents(item.amount_cents, "EUR", { signed: item.amount_cents > 0 })}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState>Nada en los próximos 30 días.</EmptyState>
          )}
          {upcoming.length > 0 && (
            <p className="text-muted mt-3 text-sm tabular-nums">
              Total pagos:{" "}
              {formatCents(
                -upcoming.filter((u) => u.item.amount_cents < 0).reduce((s, u) => s + u.item.amount_cents, 0),
              )}
            </p>
          )}
        </Tile>
      </div>

      <Tile>
        <TileTitle dot="bg-attention">Pagos recurrentes</TileTitle>
        <p className="text-muted mt-1 text-sm">
          Suscripciones, recibos y nóminas. Si pones el texto del cargo, se da por pagado solo al importar el extracto.
        </p>
        {planning.recurring.length ? (
          <ul className="mt-4 flex flex-col">
            {planning.recurring.map((r) => (
              <li
                key={r.id}
                className={clsx(
                  "border-border flex flex-wrap items-center gap-x-4 gap-y-2 border-b py-3 last:border-0",
                  !r.active && "opacity-60",
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{r.name}</p>
                  <p className="text-muted text-xs">
                    {FREQUENCY_LABELS[r.frequency]}
                    {r.category_id && ` · ${labels.get(r.category_id) ?? ""}`}
                    {r.active ? ` · próximo ${shortDate(r.next_due)}` : " · pausado"}
                    {r.paid_on && ` · último cargo ${shortDate(r.paid_on)}`}
                  </p>
                </div>
                <span className={clsx("tabular-nums", r.amount_cents > 0 && "text-finance")}>
                  {formatCents(r.amount_cents, "EUR", { signed: r.amount_cents > 0 })}
                </span>
                <RecurringActions item={r} due={r.next_due} {...formProps} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState>Aún no tienes pagos recurrentes.</EmptyState>
        )}

        {suggestions.length > 0 && (
          <div className="border-border mt-6 border-t pt-4">
            <h3 className="font-semibold">Detectados en tus movimientos</h3>
            <p className="text-muted mt-1 text-sm">Cargos que se repiten con regularidad. Añádelos con un toque.</p>
            <ul className="mt-3 flex flex-col">
              {suggestions.map((s) => (
                <li
                  key={s.key}
                  className="border-border flex flex-wrap items-center gap-x-4 gap-y-2 border-b py-2.5 last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{s.name}</p>
                    <p className="text-muted text-xs">
                      {FREQUENCY_LABELS[s.frequency]} · {s.occurrences} cargos · último {shortDate(s.last_on)}
                    </p>
                  </div>
                  <span className={clsx("text-sm tabular-nums", s.amount_cents > 0 && "text-finance")}>
                    {formatCents(s.amount_cents, "EUR", { signed: s.amount_cents > 0 })}
                  </span>
                  <AddSuggestion suggestion={s} />
                </li>
              ))}
            </ul>
          </div>
        )}

        <details className="border-border mt-6 border-t pt-4">
          <summary className="cursor-pointer font-semibold select-none">Añadir pago recurrente</summary>
          <div className="mt-4">
            <RecurringForm {...formProps} />
          </div>
        </details>
      </Tile>

      <Tile>
        <TileTitle>Huchas</TileTitle>
        <p className="text-muted mt-1 text-sm">
          Objetivos de ahorro. Enlázalas a una cuenta para que sigan su saldo, o apunta tú lo que vas metiendo.
        </p>
        {openGoals.length ? (
          <ul className="mt-4 grid gap-3.5 md:grid-cols-2">
            {openGoals.map((g) => (
              <li key={g.id} className="bg-surface-2 rounded-inner p-5">
                <p className="flex items-baseline justify-between gap-3">
                  <span className="truncate font-semibold">{g.name}</span>
                  <span className="text-muted shrink-0 text-sm tabular-nums">
                    {Math.round(g.progress.ratio * 100)} %
                  </span>
                </p>
                <p className="font-display mt-2 text-2xl font-extrabold tracking-tight tabular-nums">
                  {formatCents(g.saved)}
                  <span className="text-muted text-base font-medium"> de {formatCents(g.target_cents)}</span>
                </p>
                <Progress ratio={g.progress.ratio} className="bg-finance" label={`Progreso de ${g.name}`} />
                <p className="text-muted mt-2 text-xs">
                  {g.progress.done
                    ? "¡Objetivo conseguido!"
                    : g.progress.perMonth !== null
                      ? `Faltan ${formatCents(g.progress.missing)} · ${formatCents(g.progress.perMonth)} al mes hasta el ${shortDate(g.target_date!)}`
                      : `Faltan ${formatCents(g.progress.missing)}`}
                  {g.account_id &&
                    ` · sigue el saldo de ${accounts.find((a) => a.id === g.account_id)?.name ?? "la cuenta"}`}
                </p>
                <GoalActions goal={g} accounts={activeAccounts} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState>Aún no tienes huchas.</EmptyState>
        )}
        {archivedGoals.length > 0 && (
          <details className="mt-4">
            <summary className="text-muted cursor-pointer text-sm select-none">
              Archivadas ({archivedGoals.length})
            </summary>
            <ul className="mt-3 flex flex-col gap-3">
              {archivedGoals.map((g) => (
                <li key={g.id} className="bg-surface-2 rounded-inner p-4 text-sm">
                  <span className="font-medium">{g.name}</span>
                  <span className="text-muted">
                    {" "}
                    · {formatCents(g.saved)} de {formatCents(g.target_cents)}
                  </span>
                  <GoalActions goal={g} accounts={activeAccounts} />
                </li>
              ))}
            </ul>
          </details>
        )}
        <details className="border-border mt-6 border-t pt-4">
          <summary className="cursor-pointer font-semibold select-none">Nueva hucha</summary>
          <div className="mt-4">
            <GoalForm accounts={activeAccounts} />
          </div>
        </details>
      </Tile>
    </>
  );
}
