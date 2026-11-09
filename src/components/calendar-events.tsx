import { formatLongDate, formatTime } from "@/lib/datetime";
import type { CalendarResult } from "@/lib/calendar/server";
import type { DateRange } from "@/lib/calendar/range";
import { groupByDay } from "@/lib/google/calendar";

const STATUS_MESSAGES = {
  not_configured: "La conexión con Google aún no está configurada en el servidor.",
  not_connected: "Falta permiso para leer tu calendario. Cierra sesión y vuelve a entrar con Google.",
  error: "No se pudo cargar tu agenda. Prueba de nuevo en unos minutos.",
} as const;

/** Lista de eventos agrupados por día, o el estado de la conexión. */
export function CalendarEvents({
  result,
  range,
  emptyText = "Nada en la agenda.",
  compact = false,
}: {
  result: CalendarResult;
  range: DateRange;
  emptyText?: string;
  compact?: boolean;
}) {
  if (result.status !== "ok") {
    return <p className="text-muted text-sm">{STATUS_MESSAGES[result.status]}</p>;
  }
  const days = groupByDay(result.events, range);
  if (days.length === 0) return <p className="text-muted">{emptyText}</p>;

  return (
    <div className="flex flex-col gap-5">
      {days.map((day) => (
        <section key={day.key} aria-label={formatLongDate(day.date)}>
          <h3 className="text-muted mb-2 text-sm font-medium first-letter:uppercase">{formatLongDate(day.date)}</h3>
          <ul className="flex flex-col gap-2">
            {day.events.slice(0, compact ? 4 : undefined).map((e) => (
              <li key={`${day.key}-${e.id}`} className="bg-surface-2 rounded-inner flex items-baseline gap-3 px-4 py-3">
                <span className="text-content w-24 shrink-0 text-sm font-semibold tabular-nums">
                  {e.allDay ? "Todo el día" : `${formatTime(e.start)}–${formatTime(e.end)}`}
                </span>
                <span className="min-w-0">
                  {e.url ? (
                    <a
                      href={e.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate font-medium hover:underline"
                    >
                      {e.title}
                    </a>
                  ) : (
                    <span className="block truncate font-medium">{e.title}</span>
                  )}
                  {e.location && !compact && <span className="text-muted block truncate text-sm">{e.location}</span>}
                </span>
              </li>
            ))}
            {compact && day.events.length > 4 && (
              <li className="text-muted px-4 text-sm">y {day.events.length - 4} más</li>
            )}
          </ul>
        </section>
      ))}
    </div>
  );
}
