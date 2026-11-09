"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { GOOGLE_SCOPES } from "@/lib/google/calendar";
import { createClient } from "@/lib/supabase/server";

async function requestOrigin(): Promise<string> {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

export async function signInWithGoogle() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${await requestOrigin()}/auth/callback`,
      scopes: GOOGLE_SCOPES.join(" "),
      // offline + consent: Google devuelve un refresh token para leer el calendario
      queryParams: { access_type: "offline", prompt: "consent" },
    },
  });
  if (error || !data.url) redirect("/login?error=auth");
  redirect(data.url);
}
