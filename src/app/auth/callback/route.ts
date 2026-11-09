import { NextResponse, type NextRequest } from "next/server";
import { loginErrorFromCallback } from "@/lib/auth/paths";
import { encryptToken } from "@/lib/crypto";
import { getGoogleConfig } from "@/lib/env.server";
import { GOOGLE_SCOPES } from "@/lib/google/calendar";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const toLogin = (error: string) => NextResponse.redirect(`${origin}/login?error=${error}`);

  const callbackError = loginErrorFromCallback(searchParams);
  if (callbackError) return toLogin(callbackError);

  const code = searchParams.get("code");
  if (!code) return toLogin("auth");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.session) {
    return toLogin(/no autorizado|saving new user/i.test(error?.message ?? "") ? "no_autorizado" : "auth");
  }

  // Guardar el refresh token de Google (cifrado) para leer el calendario
  const refreshToken = data.session.provider_refresh_token;
  const config = getGoogleConfig();
  if (refreshToken && config) {
    const { error: saveError } = await supabase.from("integrations").upsert(
      {
        user_id: data.user.id,
        provider: "google",
        encrypted_token: encryptToken(refreshToken, config.encryptionKey),
        scopes: [...GOOGLE_SCOPES],
        account_email: data.user.email ?? null,
      },
      { onConflict: "user_id,provider" },
    );
    if (saveError) console.error("[auth] no se pudo guardar la integración de Google", saveError.message);
  }

  return NextResponse.redirect(`${origin}/`);
}
