import "server-only";
import { decryptToken } from "@/lib/crypto";
import { getGoogleConfig } from "@/lib/env.server";
import { refreshAccessToken } from "@/lib/google/calendar";
import { createClient } from "@/lib/supabase/server";

export type GoogleAccess =
  { status: "ok"; accessToken: string; scopes: string[] } | { status: "not_configured" | "not_connected" };

/**
 * Token de acceso de Google del usuario actual (a partir del refresh token cifrado).
 * Puede lanzar GoogleAuthError si Google lo rechaza (hay que volver a iniciar sesión).
 */
export async function getGoogleAccess(): Promise<GoogleAccess> {
  const config = getGoogleConfig();
  if (!config) return { status: "not_configured" };

  const supabase = await createClient();
  const { data: integration } = await supabase
    .from("integrations")
    .select("encrypted_token, scopes")
    .eq("provider", "google")
    .maybeSingle();
  if (!integration?.encrypted_token) return { status: "not_connected" };

  const refreshToken = decryptToken(integration.encrypted_token, config.encryptionKey);
  const accessToken = await refreshAccessToken(refreshToken, config.clientId, config.clientSecret);
  return { status: "ok", accessToken, scopes: integration.scopes ?? [] };
}

/** ¿El inicio de sesión guardado incluye este permiso? (sin llamar a Google) */
export async function hasGoogleScope(scope: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.from("integrations").select("scopes").eq("provider", "google").maybeSingle();
  return Boolean(data?.scopes?.includes(scope));
}
