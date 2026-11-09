import Link from "next/link";
import { CalendarEvents } from "@/components/calendar-events";
import { PageHeader, PageShell } from "@/components/page-header";
import { daysFromToday } from "@/lib/calendar/range";
import { getCalendarEvents } from "@/lib/calendar/server";
import { dayKey, formatLongDate } from "@/lib/datetime";
import { formatCents } from "@/lib/finance/money";
import { financePeriods } from "@/lib/finance/periods";
import { getUpcomingPayments } from "@/lib/finance/planning-server";
import { getAccounts } from "@/lib/finance/server";
import { getPortfolio } from "@/lib/investments/server";
import { createClient } from "@/lib/supabase/server";

// Widgets que se rellenarán en fases posteriores. Sin datos, se muestra "—".
const PENDING_WIDGETS = [{ title: "Kcal del día", phase: 5, color: "bg-nutrition", span: "md:col-span-3" }] as const;

export default async function Home() {
  const now = new Date();
  const range = daysFromToday(now, 2);
  const supabase = await createClient();
  const p = financePeriods(now);
  const [{ data: profile }, agenda, accounts, { data: cashflow }, portfolio, payments, { data: lastWorkout }] =
    await Promise.all([
      supabase.from("profiles").select("display_name").maybeSingle(),
      getCalendarEvents(range),
      getAccounts(),
      supabase.rpc("monthly_cashflow", { p_from: p.monthStart, p_to: p.nextMonthStart }),
      getPortfolio(),
      getUpcomingPayments(dayKey(now), 14),
      supabase
        .from("gym_workouts")
        .select("id, title, started_at, ended_at")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
  const portfolioValue = [...portfolio.positions.values()].reduce((s, x) => s + x.valueEur, 0);
  const hasAccounts = accounts.length > 0 || portfolio.operations.length > 0;
  const currency = accounts[0]?.currency ?? "EUR";
  const netWorth = accounts.reduce((sum, a) => sum + a.balance_cents, 0) + Math.round(portfolioValue * 100);
  const monthExpense = cashflow?.[0]?.expense_cents ?? 0;
  const financeWidgets = [
    { title: "Patrimonio neto", value: hasAccounts ? formatCents(netWorth, currency) : "—", href: "/finanzas" },
    {
      title: "Gasto del mes",
      value: hasAccounts ? formatCents(monthExpense, currency) : "—",
      href: `/finanzas/movimientos?mes=${p.monthKey}&tipo=gastos`,
    },
  ];
  const firstName = profile?.display_name?.split(" ")[0];

  return (
    <PageShell>
      <PageHeader title={firstName ? `Hola, ${firstName}` : "Hola"} subtitle={formatLongDate(now)} />

      <section aria-label="Resumen" className="grid gap-3.5 md:grid-cols-6">
        <article className="rounded-tile border-border bg-surface flex flex-col border p-6 md:col-span-4 md:row-span-2">
          <div className="mb-4 flex items-center gap-3">
            <span aria-hidden="true" className="bg-content h-2.5 w-2.5 rounded-full" />
            <h2 className="font-semibold">Hoy y mañana</h2>
            <Link href="/calendario?vista=semana" className="text-muted hover:text-text ml-auto text-sm">
              Ver semana
            </Link>
          </div>
          <CalendarEvents result={agenda} range={range} emptyText="Hoy y mañana tienes la agenda libre." compact />
        </article>

        {financeWidgets.map((w) => (
          <Link
            key={w.title}
            href={w.href}
            className="rounded-tile border-border bg-surface hover:border-border-strong border p-6 transition-[border-color,transform] duration-150 active:scale-[0.98] motion-reduce:active:scale-100 md:col-span-2"
          >
            <span className="flex items-center gap-3">
              <span aria-hidden="true" className="bg-finance h-2.5 w-2.5 rounded-full" />
              <span className="font-semibold">{w.title}</span>
            </span>
            <span className="font-display mt-4 block text-3xl font-extrabold tracking-tight">{w.value}</span>
            <span className="text-muted mt-1 block text-sm">{hasAccounts ? "Ver finanzas" : "Crea tus cuentas"}</span>
          </Link>
        ))}

        <Link
          href="/finanzas/plan"
          className="rounded-tile border-border bg-surface hover:border-border-strong flex flex-col border p-6 transition-[border-color,transform] duration-150 active:scale-[0.98] motion-reduce:active:scale-100 md:col-span-2"
        >
          <span className="flex items-center gap-3">
            <span aria-hidden="true" className="bg-attention h-2.5 w-2.5 rounded-full" />
            <span className="font-semibold">Próximos pagos</span>
          </span>
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

        <Link
          href={lastWorkout ? `/gimnasio/entreno/${lastWorkout.id}` : "/gimnasio/importar"}
          className="rounded-tile border-border bg-surface hover:border-border-strong flex flex-col border p-6 transition-[border-color,transform] duration-150 active:scale-[0.98] motion-reduce:active:scale-100 md:col-span-3"
        >
          <span className="flex items-center gap-3">
            <span aria-hidden="true" className="bg-gym h-2.5 w-2.5 rounded-full" />
            <span className="font-semibold">Último entreno</span>
          </span>
          {lastWorkout ? (
            <>
              <span className="font-display mt-4 block truncate text-3xl font-extrabold tracking-tight">
                {lastWorkout.title}
              </span>
              <span className="text-muted mt-1 block text-sm first-letter:uppercase">
                {new Intl.DateTimeFormat("es-ES", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  timeZone: "Europe/Madrid",
                }).format(new Date(lastWorkout.started_at))}
                {lastWorkout.ended_at &&
                  ` · ${Math.round((Date.parse(lastWorkout.ended_at) - Date.parse(lastWorkout.started_at)) / 60000)} min`}
              </span>
            </>
          ) : (
            <span className="text-muted mt-4 block text-sm">Importa tus entrenos de Hevy</span>
          )}
        </Link>

        {PENDING_WIDGETS.map((w) => (
          <article key={w.title} className={`rounded-tile border-border bg-surface border p-6 ${w.span}`}>
            <div className="flex items-center gap-3">
              <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${w.color}`} />
              <h2 className="font-semibold">{w.title}</h2>
            </div>
            <p className="font-display mt-4 text-4xl font-extrabold tracking-tight">—</p>
            <p className="text-muted mt-1 text-sm">Se activa en la fase {w.phase}</p>
          </article>
        ))}
      </section>
    </PageShell>
  );
}
