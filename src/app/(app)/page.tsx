import Link from "next/link";
import { clsx } from "clsx";
import { CalendarEvents } from "@/components/calendar-events";
import { PageHeader, PageShell } from "@/components/page-header";
import { daysFromToday } from "@/lib/calendar/range";
import { getCalendarEvents } from "@/lib/calendar/server";
import { dayKey, formatLongDate } from "@/lib/datetime";
import { salaryFor, sumByMonth } from "@/lib/finance/income";
import { formatCents } from "@/lib/finance/money";
import { financePeriods } from "@/lib/finance/periods";
import { getUpcomingPayments } from "@/lib/finance/planning-server";
import { getAccounts, getIncomeData } from "@/lib/finance/server";
import { getPortfolio } from "@/lib/investments/server";
import { getActivePlan, getDay } from "@/lib/nutrition/server";
import { createClient } from "@/lib/supabase/server";
import { getTasks } from "@/lib/tasks/server";

const tileLink =
  "rounded-tile border-border bg-surface hover:border-border-strong flex flex-col border p-6 transition-[border-color,transform] duration-150 active:scale-[0.98] motion-reduce:active:scale-100";

function TileHead({ dot, children }: { dot: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-3">
      <span aria-hidden="true" className={clsx("h-2.5 w-2.5 rounded-full", dot)} />
      <span className="font-semibold">{children}</span>
    </span>
  );
}

const pct = (v: number | null) =>
  v == null ? "—" : `${v >= 0 ? "+" : ""}${(v * 100).toLocaleString("es-ES", { maximumFractionDigits: 1 })} %`;

const shortWhen = (iso: string) =>
  new Intl.DateTimeFormat("es-ES", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Madrid",
  }).format(new Date(iso));

// Portada: de un vistazo lo de hoy (agenda, dinero, comidas y tareas) en mosaico
export default async function Home() {
  const now = new Date();
  const range = daysFromToday(now, 2);
  const supabase = await createClient();
  const p = financePeriods(now);
  const today = dayKey(now);
  const [
    { data: profile },
    agenda,
    accounts,
    { data: cashflow },
    portfolio,
    payments,
    plan,
    nutritionDay,
    tasks,
    income,
  ] = await Promise.all([
    supabase.from("profiles").select("display_name").maybeSingle(),
    getCalendarEvents(range),
    getAccounts(),
    supabase.rpc("monthly_cashflow", { p_from: p.monthStart, p_to: p.nextMonthStart }),
    getPortfolio(),
    getUpcomingPayments(today, 14),
    getActivePlan(),
    getDay(today),
    getTasks(),
    getIncomeData(p.monthStart),
  ]);
  const activeTasks = tasks.filter((t) => !t.archived);
  const mealsOnPlan = plan ? plan.meals.filter((m) => nutritionDay.checks.get(m.id)?.status === "done").length : 0;
  const mealsMarked = plan ? plan.meals.filter((m) => nutritionDay.checks.has(m.id)).length : 0;
  const portfolioValue = [...portfolio.positions.values()].reduce((s, x) => s + x.valueEur, 0);
  const hasAccounts = accounts.length > 0 || portfolio.operations.length > 0;
  const hasPortfolio = portfolio.operations.length > 0;
  const netWorth = accounts.reduce((sum, a) => sum + a.balance_cents, 0) + Math.round(portfolioValue * 100);
  const expense = cashflow?.[0]?.expense_cents ?? 0;
  const salary = salaryFor(p.monthKey, sumByMonth(income.salary), income.fallbackSalaryCents, p.monthKey);
  const left = salary.cents - expense;
  const spentShare = salary.cents > 0 ? Math.min(1, expense / salary.cents) : 0;
  const ret = (period: string) => portfolio.returns.find((r) => r.period === period);
  const day = ret("1D");
  const ytd = ret("YTD");
  const firstName = profile?.display_name?.split(" ")[0];

  return (
    <PageShell>
      <PageHeader title={firstName ? `Hola, ${firstName}` : "Hola"} subtitle={formatLongDate(now)} />

      <section aria-label="Resumen" className="grid gap-3.5 md:grid-cols-6">
        <article className="rounded-tile border-border bg-surface flex flex-col border p-6 md:col-span-4 md:row-span-2">
          <div className="mb-4">
            <TileHead dot="bg-content">Hoy y mañana</TileHead>
          </div>
          <CalendarEvents result={agenda} range={range} emptyText="Hoy y mañana tienes la agenda libre." compact />
        </article>

        <Link href="/finanzas" className={clsx(tileLink, "md:col-span-2")}>
          <TileHead dot="bg-finance">Patrimonio</TileHead>
          <span className="font-display mt-4 block text-3xl font-extrabold tabular-nums">
            {hasAccounts ? formatCents(netWorth) : "—"}
          </span>
          <span className="text-muted mt-1 block text-sm">
            {hasAccounts ? "Cuentas e inversiones" : "Crea tus cuentas"}
          </span>
        </Link>

        <Link href="/inversiones" className={clsx(tileLink, "md:col-span-2")}>
          <TileHead dot="bg-finance">Inversiones</TileHead>
          <span className="font-display mt-4 block text-3xl font-extrabold tabular-nums">
            {hasPortfolio ? formatCents(Math.round(portfolioValue * 100)) : "—"}
          </span>
          {hasPortfolio ? (
            <span className="mt-1 block text-sm tabular-nums">
              <span className={clsx((day?.pnlEur ?? 0) >= 0 ? "text-up" : "text-down")}>
                {formatCents(Math.round((day?.pnlEur ?? 0) * 100), "EUR", { signed: true })} hoy
              </span>
              <span className="text-muted"> · {pct(ytd?.returnPct ?? null)} en el año</span>
            </span>
          ) : (
            <span className="text-muted mt-1 block text-sm">Importa tu cartera</span>
          )}
        </Link>

        <Link href="/finanzas/gastos" className={clsx(tileLink, "md:col-span-2")}>
          <TileHead dot="bg-expense">Te queda este mes</TileHead>
          <span
            className={clsx(
              "font-display mt-4 block text-3xl font-extrabold tabular-nums",
              salary.cents > 0 && left < 0 && "text-expense",
            )}
          >
            {salary.cents > 0 ? formatCents(left, "EUR", { signed: left < 0 }) : formatCents(expense)}
          </span>
          {salary.cents > 0 ? (
            <>
              <span className="text-muted mt-1 block text-sm tabular-nums">
                Gastado {formatCents(expense)} de {formatCents(salary.cents)}
              </span>
              <span aria-hidden="true" className="bg-surface-2 mt-3 block h-1.5 overflow-hidden rounded-full">
                <span
                  className={clsx("block h-full rounded-full", spentShare >= 1 ? "bg-expense" : "bg-finance")}
                  style={{ width: `${Math.round(spentShare * 100)}%` }}
                />
              </span>
            </>
          ) : (
            <span className="text-muted mt-1 block text-sm">Gastado este mes · apunta tu salario en Ajustes</span>
          )}
        </Link>

        <Link href="/finanzas/analisis" className={clsx(tileLink, "md:col-span-2")}>
          <TileHead dot="bg-attention">Próximos pagos</TileHead>
          {payments.upcoming.length ? (
            <ul className="mt-4 flex flex-col gap-1.5 text-sm">
              {payments.upcoming.slice(0, 4).map(({ item, date }) => (
                <li key={`${item.id}-${date}`} className="flex items-baseline gap-2">
                  <span className="text-muted w-12 shrink-0 tabular-nums">
                    {new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: "UTC" }).format(
                      new Date(`${date}T00:00:00Z`),
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{item.name}</span>
                  <span className="shrink-0 tabular-nums">{formatCents(item.amount_cents)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <span className="text-muted mt-4 block text-sm">
              {payments.count ? "Nada en las próximas dos semanas." : "Añade tus pagos recurrentes"}
            </span>
          )}
        </Link>

        <Link href="/nutricion" className={clsx(tileLink, "md:col-span-2")}>
          <TileHead dot="bg-nutrition">Nutrición de hoy</TileHead>
          {plan ? (
            <>
              <span className="font-display mt-4 block text-3xl font-extrabold tabular-nums">
                {mealsMarked}/{plan.meals.length} comidas
              </span>
              <span className="text-muted mt-1 block text-sm">
                {mealsMarked ? `${mealsOnPlan} según el plan` : "Marca cómo vas con el plan"}
              </span>
            </>
          ) : (
            <span className="text-muted mt-4 block text-sm">Configura tu plan nutricional</span>
          )}
        </Link>
      </section>

      {activeTasks.length > 0 && (
        <section aria-labelledby="tareas-hoy" className="flex flex-col gap-3">
          <div className="flex items-baseline gap-3">
            <h2 id="tareas-hoy" className="text-xl font-bold">
              Tareas
            </h2>
            <Link href="/tareas" className="text-muted hover:text-text text-sm">
              Ver todas
            </Link>
          </div>
          <ul className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
            {activeTasks.map((t) => (
              <li key={t.id}>
                <Link href={`/tareas/${t.slug}`} className={clsx(tileLink, "h-full gap-1 p-5")}>
                  <span className="truncate font-semibold">{t.name}</span>
                  <span
                    className={clsx(
                      "font-display text-2xl font-extrabold tabular-nums",
                      t.newItems > 0 ? "text-attention" : "text-muted",
                    )}
                  >
                    {t.newItems > 0 ? `${t.newItems} ${t.newItems === 1 ? "nuevo" : "nuevos"}` : "Al día"}
                  </span>
                  <span className="text-muted text-xs">
                    {t.lastRun
                      ? `${t.lastRun.ok ? "" : "✕ Falló · "}${shortWhen(t.lastRun.ranAt)}`
                      : "Aún no ha corrido"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </PageShell>
  );
}
