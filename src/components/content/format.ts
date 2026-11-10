import { APP_LOCALE, APP_TIMEZONE } from "@/lib/datetime";

// Formatos de fecha y cifra del módulo de Contenido (hora de Madrid)

const shortDate = new Intl.DateTimeFormat(APP_LOCALE, { timeZone: APP_TIMEZONE, day: "numeric", month: "short" });
const dateTime = new Intl.DateTimeFormat(APP_LOCALE, {
  timeZone: APP_TIMEZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
const compact = new Intl.NumberFormat(APP_LOCALE, { notation: "compact", maximumFractionDigits: 1 });
const percent = new Intl.NumberFormat(APP_LOCALE, { style: "percent", maximumFractionDigits: 1 });

export const formatShortDate = (iso: string) => shortDate.format(new Date(iso));
export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));
export const formatCompact = (n: number) => compact.format(n);
export const formatPercent = (n: number | null) => (n === null ? "—" : percent.format(n));

/** ISO UTC → valor para <input type="datetime-local"> en hora de Madrid. */
export function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: APP_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
