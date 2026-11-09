import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasSupabaseAuthCookie, isPublicPath } from "@/lib/auth/paths";
import { env } from "@/lib/env";
import type { Database } from "./database.types";

function redirectTo(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  return NextResponse.redirect(url);
}

/** Renueva la sesión en cada petición y protege las rutas privadas. */
export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = isPublicPath(pathname);

  // Sin cookie de sesión no hace falta preguntar a Supabase
  if (!hasSupabaseAuthCookie(request.cookies.getAll().map((c) => c.name))) {
    return isPublic ? NextResponse.next({ request }) : redirectTo(request, "/login");
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // getUser valida el JWT contra Supabase (no fiarse solo de la cookie)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const target = !user && !isPublic ? "/login" : user && pathname === "/login" ? "/" : null;
  if (!target) return response;

  // Conservar las cookies renovadas en la redirección
  const redirect = redirectTo(request, target);
  response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
  return redirect;
}
