import type { Metadata } from "next";
import Link from "next/link";
import { clsx } from "clsx";
import { Tile, TileTitle } from "@/components/ui";
import { STATUS_LABEL, type PieceStatus } from "@/lib/content/catalog";
import { monthGrid, monthKey, parseMonth, shiftMonth } from "@/lib/content/month";
import { contentSession } from "@/lib/content/server";
import { APP_LOCALE, APP_TIMEZONE, dayKey, formatTime, wallClockDate, zonedMidnight } from "@/lib/datetime";

export const metadata: Metadata = { title: "Calendario editorial · Contenido" };

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export default async function EditorialCalendarPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const now = wallClockDate(new Date());
  const current = parseMonth((await searchParams).mes, { year: now.year, month: now.month });
  const weeks = monthGrid(current);
  const first = weeks[0][0].key.split("-").map(Number);
  const last = weeks.at(-1)!.at(-1)!.key.split("-").map(Number);
  const from = zonedMidnight(first[0], first[1], first[2]);
  const to = zonedMidnight(last[0], last[1], last[2] + 1);

  const supabase = await contentSession();
  const [{ data: pieces }, { count: undated }] = await Promise.all([
    supabase
      .from("content_pieces")
      .select("id, title, status, publish_at")
      .gte("publish_at", from.toISOString())
      .lt("publish_at", to.toISOString())
      .order("publish_at"),
    supabase
      .from("content_pieces")
      .select("id", { count: "exact", head: true })
      .is("publish_at", null)
      .in("status", ["editing", "scheduled"]),
  ]);

  const byDay = new Map<string, NonNullable<typeof pieces>>();
  for (const p of pieces ?? []) {
    const key = dayKey(new Date(p.publish_at!));
    byDay.set(key, [...(byDay.get(key) ?? []), p]);
  }
  const today = dayKey(new Date());
  const title = new Intl.DateTimeFormat(APP_LOCALE, { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(current.year, current.month - 1, 15)),
  );

  return (
    <Tile className="p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TileTitle dot="bg-content">
          <span className="first-letter:uppercase">{title}</span>
        </TileTitle>
        <nav aria-label="Cambiar de mes" className="flex items-center gap-1">
          <Link
            href={`/contenido/calendario?mes=${monthKey(shiftMonth(current, -1))}`}
            className="hover:bg-surface-2 rounded-full px-3 py-1.5 text-sm"
            aria-label="Mes anterior"
          >
            ←
          </Link>
          <Link href="/contenido/calendario" className="hover:bg-surface-2 rounded-full px-3 py-1.5 text-sm">
            Hoy
          </Link>
          <Link
            href={`/contenido/calendario?mes=${monthKey(shiftMonth(current, 1))}`}
            className="hover:bg-surface-2 rounded-full px-3 py-1.5 text-sm"
            aria-label="Mes siguiente"
          >
            →
          </Link>
        </nav>
      </div>
      <p className="text-muted mt-1 text-sm">
        Las fechas de publicación se llevan solas a tu Google Calendar.
        {undated ? ` Tienes ${undated} pieza(s) en edición o programadas sin fecha.` : ""}
      </p>

      <div className="-mx-4 mt-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[44rem] table-fixed border-separate border-spacing-1">
          <caption className="sr-only">Publicaciones de {title}</caption>
          <thead>
            <tr>
              {WEEKDAYS.map((d) => (
                <th key={d} scope="col" className="text-muted pb-1 text-xs font-medium">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week) => (
              <tr key={week[0].key}>
                {week.map((day) => {
                  const items = byDay.get(day.key) ?? [];
                  return (
                    <td
                      key={day.key}
                      className={clsx(
                        "rounded-inner h-28 p-1.5 align-top",
                        day.inMonth ? "bg-surface-2" : "bg-surface-2/40",
                        day.key === today && "ring-content ring-1",
                      )}
                    >
                      <span
                        className={clsx(
                          "block text-xs tabular-nums",
                          day.inMonth ? "text-text" : "text-muted",
                          day.key === today && "text-content font-semibold",
                        )}
                      >
                        {day.day}
                      </span>
                      <ul className="mt-1 flex flex-col gap-1">
                        {items.map((p) => (
                          <li key={p.id}>
                            <Link
                              href={`/contenido/pieza/${p.id}`}
                              title={`${STATUS_LABEL[p.status as PieceStatus]} · ${formatTime(new Date(p.publish_at!), APP_TIMEZONE)}`}
                              className={clsx(
                                "block truncate rounded-md px-1.5 py-0.5 text-xs font-medium",
                                p.status === "published"
                                  ? "bg-content text-ink"
                                  : "border-content/60 text-text border border-dashed",
                              )}
                            >
                              {formatTime(new Date(p.publish_at!), APP_TIMEZONE)} {p.title}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-muted mt-3 flex flex-wrap gap-4 text-xs">
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="bg-content h-2.5 w-4 rounded-sm" /> Publicado
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="border-content/60 h-2.5 w-4 rounded-sm border border-dashed" /> Pendiente
        </span>
      </p>
    </Tile>
  );
}
