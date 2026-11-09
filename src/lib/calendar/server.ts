import "server-only";
import { decryptToken } from "@/lib/crypto";
import { getGoogleConfig } from "@/lib/env.server";
import { fetchEvents, GoogleAuthError, refreshAccessToken, type CalendarEvent } from "@/lib/google/calendar";
import { createClient } from "@/lib/supabase/server";
import type { DateRange } from "./range";

export type CalendarResult =
  { status: "ok"; events: CalendarEvent[] } | { status: "not_configured" | "not_connected" | "error" };

/** Lee los eventos del calendario principal de Google del usuario actual. */
export async function getCalendarEvents(range: DateRange): Promise<CalendarResult> {
  const config = getGoogleConfig();
  if (!config) return { status: "not_configured" };

  const supabase = await createClient();
  const { data: integration } = await supabase
    .from("integrations")
    .select("encrypted_token")
    .eq("provider", "google")
    .maybeSingle();
  if (!integration?.encrypted_token) return { status: "not_connected" };

  try {
    const refreshToken = decryptToken(integration.encrypted_token, config.encryptionKey);
    const accessToken = await refreshAccessToken(refreshToken, config.clientId, config.clientSecret);
    return { status: "ok", events: await fetchEvents(accessToken, range) };
  } catch (error) {
    console.error("[calendario]", error instanceof Error ? error.message : error);
    return { status: error instanceof GoogleAuthError ? "not_connected" : "error" };
  }
}
