import Link from "next/link";
import { CalendarEvents } from "@/components/calendar-events";
import { PageHeader, PageShell } from "@/components/page-header";
import { daysFromToday } from "@/lib/calendar/range";
import { getCalendarEvents } from "@/lib/calendar/server";
import { formatLongDate } from "@/lib/datetime";
import { createClient } from "@/lib/supabase/server";

// Widgets que se rellenarán en fases posteriores. Sin datos, se muestra "—".
const PENDING_WIDGETS = [
  { title: "Patrimonio neto", phase: 2, color: "bg-finance", span: "md:col-span-2" },
  { title: "Gasto del mes", phase: 2, color: "bg-finance", span: "md:col-span-2" },
  { title: "Próximos pagos", phase: 3, color: "bg-attention", span: "md:col-span-2" },
  { title: "Último entreno", phase: 5, color: "bg-gym", span: "md:col-span-3" },
  { title: "Kcal del día", phase: 6, color: "bg-nutrition", span: "md:col-span-3" },
] as const;

export default async function Home() {
  const now = new Date();
  const range = daysFromToday(now, 2);
  const supabase = await createClient();
  const [{ data: profile }, agenda] = await Promise.all([
    supabase.from("profiles").select("display_name").maybeSingle(),
    getCalendarEvents(range),
  ]);
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
