import { APP_TIMEZONE, wallClockDate, zonedMidnight } from "@/lib/datetime";

export const CALENDAR_VIEWS = ["hoy", "semana", "mes"] as const;
export type CalendarView = (typeof CALENDAR_VIEWS)[number];

export interface DateRange {
  start: Date;
  end: Date; // exclusivo
}

export function parseView(value: string | string[] | undefined): CalendarView {
  const v = Array.isArray(value) ? value[0] : value;
  return (CALENDAR_VIEWS as readonly string[]).includes(v ?? "") ? (v as CalendarView) : "hoy";
}

/** N días locales completos a partir de hoy. */
export function daysFromToday(now: Date, days: number, timeZone = APP_TIMEZONE): DateRange {
  const { year, month, day } = wallClockDate(now, timeZone);
  return { start: zonedMidnight(year, month, day, timeZone), end: zonedMidnight(year, month, day + days, timeZone) };
}

/** Rango de la vista: hoy, semana (lunes a domingo) o mes natural. */
export function rangeForView(view: CalendarView, now: Date, timeZone = APP_TIMEZONE): DateRange {
  const { year, month, day } = wallClockDate(now, timeZone);
  if (view === "hoy") return daysFromToday(now, 1, timeZone);
  if (view === "semana") {
    // getUTCDay sobre la fecha local: 0 = domingo
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    const monday = day - ((weekday + 6) % 7);
    return {
      start: zonedMidnight(year, month, monday, timeZone),
      end: zonedMidnight(year, month, monday + 7, timeZone),
    };
  }
  return { start: zonedMidnight(year, month, 1, timeZone), end: zonedMidnight(year, month + 1, 1, timeZone) };
}
