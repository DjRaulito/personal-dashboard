// Rutas accesibles sin sesión.
const PUBLIC_PREFIXES = ["/login", "/auth/", "/api/health/", "/api/brain/mcp", "/manifest.webmanifest"];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p.endsWith("/") ? p : `${p}/`));
}

/** ¿Hay alguna cookie de sesión de Supabase? (sb-<ref>-auth-token, posiblemente troceada) */
export function hasSupabaseAuthCookie(names: string[]): boolean {
  return names.some((n) => /^sb-.+-auth-token(\.\d+)?$/.test(n));
}

export type LoginError = "no_autorizado" | "auth";

/** Traduce los errores que Supabase devuelve en el callback de OAuth. */
export function loginErrorFromCallback(params: URLSearchParams): LoginError | null {
  const error = params.get("error");
  if (!error) return null;
  const description = params.get("error_description") ?? "";
  // El trigger de lista blanca aborta el alta -> "Database error saving new user"
  if (/database error saving new user|no autorizado/i.test(description)) return "no_autorizado";
  return "auth";
}

export const LOGIN_ERROR_MESSAGES: Record<LoginError, string> = {
  no_autorizado: "Esta cuenta de Google no tiene acceso.",
  auth: "No se pudo iniciar sesión. Inténtalo de nuevo.",
};
