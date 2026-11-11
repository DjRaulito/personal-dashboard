import { z } from "zod";
import { APP_TIMEZONE, dayKey, zonedMidnight } from "@/lib/datetime";
import type { DateRange } from "@/lib/calendar/range";

/**
 * Permisos que pedimos a Google al iniciar sesión: leer y crear eventos (calendario editorial) y
 * archivos de Drive creados por la app (vídeos del estudio; no ve el resto de tu Drive).
 */
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/drive.file",
] as const;

export const CALENDAR_WRITE_SCOPE = "https://www.googleapis.com/auth/calendar.events";
export const DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  location: string | null;
  url: string | null;
}

const eventTime = z.object({ dateTime: z.string().optional(), date: z.string().optional() });

const googleEvent = z.object({
  id: z.string(),
  status: z.string().optional(),
  summary: z.string().optional(),
  location: z.string().optional(),
  htmlLink: z.string().optional(),
  start: eventTime,
  end: eventTime,
});

const eventsResponse = z.object({ items: z.array(z.unknown()).default([]) });

function parseAllDay(date: string, timeZone: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return zonedMidnight(y, m, d, timeZone);
}

/** Convierte la respuesta de la API en eventos normalizados y ordenados. */
export function normalizeEvents(payload: unknown, timeZone = APP_TIMEZONE): CalendarEvent[] {
  const { items } = eventsResponse.parse(payload);
  const events: CalendarEvent[] = [];
  for (const raw of items) {
    const parsed = googleEvent.safeParse(raw);
    if (!parsed.success || parsed.data.status === "cancelled") continue;
    const e = parsed.data;
    const allDay = !e.start.dateTime && !!e.start.date;
    const start = e.start.dateTime
      ? new Date(e.start.dateTime)
      : e.start.date
        ? parseAllDay(e.start.date, timeZone)
        : null;
    const end = e.end.dateTime ? new Date(e.end.dateTime) : e.end.date ? parseAllDay(e.end.date, timeZone) : start;
    if (!start || !end || Number.isNaN(start.getTime())) continue;
    events.push({
      id: e.id,
      title: e.summary?.trim() || "(Sin título)",
      start,
      end,
      allDay,
      location: e.location ?? null,
      url: e.htmlLink ?? null,
    });
  }
  return events.sort((a, b) => a.start.getTime() - b.start.getTime() || Number(b.allDay) - Number(a.allDay));
}

/** Agrupa los eventos por día local (un evento de varios días aparece en cada día). */
export function groupByDay(events: CalendarEvent[], range: DateRange, timeZone = APP_TIMEZONE) {
  const groups = new Map<string, { date: Date; events: CalendarEvent[] }>();
  for (const event of events) {
    const from = Math.max(event.start.getTime(), range.start.getTime());
    // El fin es exclusivo: restamos 1 ms para no contar el día siguiente
    const to = Math.min(Math.max(event.end.getTime() - 1, event.start.getTime()), range.end.getTime() - 1);
    let cursor = new Date(from);
    const seen = new Set<string>();
    while (cursor.getTime() <= to) {
      const key = dayKey(cursor, timeZone);
      if (!seen.has(key)) {
        seen.add(key);
        const group = groups.get(key) ?? { date: new Date(cursor), events: [] };
        group.events.push(event);
        groups.set(key, group);
      }
      cursor = new Date(cursor.getTime() + 6 * 60 * 60 * 1000);
    }
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, g]) => ({ key, ...g }));
}

export async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new GoogleAuthError(`Google rechazó el token (${res.status})`);
  const { access_token } = z.object({ access_token: z.string() }).parse(await res.json());
  return access_token;
}

export class GoogleAuthError extends Error {}

export async function fetchEvents(accessToken: string, range: DateRange): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({
    timeMin: range.start.toISOString(),
    timeMax: range.end.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
    timeZone: APP_TIMEZONE,
  });
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (res.status === 401 || res.status === 403)
    throw new GoogleAuthError(`Sin permiso para el calendario (${res.status})`);
  if (!res.ok) throw new Error(`Error de Google Calendar (${res.status})`);
  return normalizeEvents(await res.json());
}

export interface CalendarEventInput {
  title: string;
  description: string;
  start: Date;
  /** Duración en minutos */
  minutes: number;
}

/** Crea o actualiza un evento en el calendario principal. Devuelve su id. */
export async function upsertCalendarEvent(
  accessToken: string,
  eventId: string | null,
  input: CalendarEventInput,
): Promise<string> {
  const body = JSON.stringify({
    summary: input.title,
    description: input.description,
    start: { dateTime: input.start.toISOString(), timeZone: APP_TIMEZONE },
    end: { dateTime: new Date(input.start.getTime() + input.minutes * 60_000).toISOString(), timeZone: APP_TIMEZONE },
  });
  const base = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
  const headers = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };
  let res = eventId
    ? await fetch(`${base}/${encodeURIComponent(eventId)}`, { method: "PUT", headers, body, cache: "no-store" })
    : null;
  // Si el evento se borró en Google, se crea otro
  if (!res || res.status === 404 || res.status === 410) {
    res = await fetch(base, { method: "POST", headers, body, cache: "no-store" });
  }
  if (res.status === 401 || res.status === 403)
    throw new GoogleAuthError(`Sin permiso para escribir en el calendario (${res.status})`);
  if (!res.ok) throw new Error(`Error de Google Calendar (${res.status})`);
  return z.object({ id: z.string() }).parse(await res.json()).id;
}

export async function deleteCalendarEvent(accessToken: string, eventId: string): Promise<void> {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" },
  );
  if (!res.ok && res.status !== 404 && res.status !== 410) throw new Error(`Error de Google Calendar (${res.status})`);
}
