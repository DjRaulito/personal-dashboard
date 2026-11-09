import type { Metadata } from "next";
import Link from "next/link";
import { clsx } from "clsx";
import { CalendarEvents } from "@/components/calendar-events";
import { PageHeader, PageShell } from "@/components/page-header";
import { CALENDAR_VIEWS, parseView, rangeForView, type CalendarView } from "@/lib/calendar/range";
import { getCalendarEvents } from "@/lib/calendar/server";
import { APP_LOCALE, APP_TIMEZONE } from "@/lib/datetime";

export const metadata: Metadata = { title: "Calendario · Personal Dashboard" };

const VIEW_LABELS: Record<CalendarView, string> = { hoy: "Hoy", semana: "Semana", mes: "Mes" };

function rangeLabel(view: CalendarView, start: Date, end: Date): string {
  const fmt = (d: Date, o: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(APP_LOCALE, { timeZone: APP_TIMEZONE, ...o }).format(d);
  if (view === "hoy") return fmt(start, { weekday: "long", day: "numeric", month: "long" });
  if (view === "mes") return fmt(start, { month: "long", year: "numeric" });
  const last = new Date(end.getTime() - 1);
  return `${fmt(start, { day: "numeric", month: "short" })} – ${fmt(last, { day: "numeric", month: "short" })}`;
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  const view = parseView((await searchParams).vista);
  const range = rangeForView(view, new Date());
  const result = await getCalendarEvents(range);

  return (
    <PageShell>
      <PageHeader title="Calendario" subtitle={rangeLabel(view, range.start, range.end)}>
        <nav aria-label="Vista" className="bg-surface border-border flex rounded-full border p-1">
          {CALENDAR_VIEWS.map((v) => (
            <Link
              key={v}
              href={v === "hoy" ? "/calendario" : `/calendario?vista=${v}`}
              aria-current={v === view ? "page" : undefined}
              className={clsx(
                "rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-200",
                v === view ? "bg-content text-ink" : "text-muted hover:text-text",
              )}
            >
              {VIEW_LABELS[v]}
            </Link>
          ))}
        </nav>
      </PageHeader>
      <section className="rounded-tile border-border bg-surface border p-6">
        <CalendarEvents
          result={result}
          range={range}
          emptyText={view === "hoy" ? "Hoy no tienes nada en la agenda." : "Nada en la agenda en estas fechas."}
        />
      </section>
    </PageShell>
  );
}
