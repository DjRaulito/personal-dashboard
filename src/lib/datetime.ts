// Utilidades de fecha: en BD todo es UTC; en pantalla, Europe/Madrid.
export const APP_TIMEZONE = "Europe/Madrid";
export const APP_LOCALE = "es-ES";

interface WallClock {
  year: number;
  month: number; // 1-12
  day: number;
}

/** Fecha de calendario (año, mes, día) de un instante en una zona horaria. */
export function wallClockDate(instant: Date, timeZone = APP_TIMEZONE): WallClock {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

/** Desfase en ms de la zona respecto a UTC en un instante dado. */
function offsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** Instante UTC de la medianoche local de una fecha (acepta días/meses desbordados). */
export function zonedMidnight(year: number, month: number, day: number, timeZone = APP_TIMEZONE): Date {
  const guess = Date.UTC(year, month - 1, day);
  let result = guess - offsetMs(new Date(guess), timeZone);
  // Segunda pasada por si el cambio de hora cae entre la suposición y el resultado
  result = guess - offsetMs(new Date(result), timeZone);
  return new Date(result);
}

/** Instante UTC de una hora local (año, mes 1-12, día, hora, minuto) en una zona horaria. */
export function zonedDateTime(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone = APP_TIMEZONE,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  let result = guess - offsetMs(new Date(guess), timeZone);
  result = guess - offsetMs(new Date(result), timeZone);
  return new Date(result);
}

/** Clave YYYY-MM-DD del día local de un instante. */
export function dayKey(instant: Date, timeZone = APP_TIMEZONE): string {
  const { year, month, day } = wallClockDate(instant, timeZone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function formatTime(instant: Date, timeZone = APP_TIMEZONE): string {
  return new Intl.DateTimeFormat(APP_LOCALE, { timeZone, hour: "2-digit", minute: "2-digit" }).format(instant);
}

export function formatLongDate(instant: Date, timeZone = APP_TIMEZONE): string {
  return new Intl.DateTimeFormat(APP_LOCALE, { timeZone, weekday: "long", day: "numeric", month: "long" }).format(
    instant,
  );
}
