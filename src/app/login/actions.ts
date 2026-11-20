"use server";

import { cookies, headers } from "next/headers";
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

/**
 * Entrar: solo nombre y email, sin pantalla de permisos (Google la recuerda tras la primera vez).
 * El acceso a calendario, hojas y Drive se da aparte, una vez, en Ajustes → Conexiones.
 */
export async function signInWithGoogle() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${await requestOrigin()}/auth/callback` },
  });
  if (error || !data.url) redirect("/login?error=auth");
  redirect(data.url);
}

/**
 * Conectar (o reconectar) Google: pide los permisos con offline + consent para recibir un refresh
 * token, que se guarda cifrado. Solo hace falta una vez o cuando Google lo caduca.
 */
export async function connectGoogle() {
  // A dónde volver tras el callback (cookie corta: así la URL de vuelta no cambia)
  (await cookies()).set("auth_next", "/ajustes/conexiones", {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    maxAge: 600,
    path: "/",
  });
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${await requestOrigin()}/auth/callback`,
      scopes: GOOGLE_SCOPES.join(" "),
      queryParams: { access_type: "offline", prompt: "consent", include_granted_scopes: "true" },
    },
  });
  if (error || !data.url) redirect("/ajustes/conexiones?google=error");
  redirect(data.url);
}
