import "server-only";
import { fetchEvents, GoogleAuthError, type CalendarEvent } from "@/lib/google/calendar";
import { getGoogleAccess } from "@/lib/google/server";
import type { DateRange } from "./range";

export type CalendarResult =
  { status: "ok"; events: CalendarEvent[] } | { status: "not_configured" | "not_connected" | "error" };

/** Lee los eventos del calendario principal de Google del usuario actual. */
export async function getCalendarEvents(range: DateRange): Promise<CalendarResult> {
  try {
    const access = await getGoogleAccess();
    if (access.status !== "ok") return { status: access.status };
    return { status: "ok", events: await fetchEvents(access.accessToken, range) };
  } catch (error) {
    console.error("[calendario]", error instanceof Error ? error.message : error);
    return { status: error instanceof GoogleAuthError ? "not_connected" : "error" };
  }
}
