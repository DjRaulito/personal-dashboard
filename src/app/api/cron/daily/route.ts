import { createClient as createSupabase } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { netWorthNow, saveSnapshot } from "@/lib/finance/net-worth";
import { refreshMarketData } from "@/lib/investments/refresh";
import type { Database } from "@/lib/supabase/database.types";
import type { createClient } from "@/lib/supabase/server";

// Tarea diaria (cron de Vercel, plan Hobby: una vez al día). Actualiza precios y tipos de cambio
// y guarda la foto del patrimonio aunque no abras la app.
// Necesita CRON_SECRET (Vercel lo manda en la cabecera) y SUPABASE_SECRET_KEY, solo para abrir
// una sesión del dueño de los datos: todo lo demás pasa por RLS como si fuera él.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Supabase = Awaited<ReturnType<typeof createClient>>;

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const adminKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !publishable || !adminKey) {
    return NextResponse.json({ error: "Falta SUPABASE_SECRET_KEY en Vercel" }, { status: 503 });
  }

  const admin = createSupabase<Database>(url, adminKey, noSession);
  const { data: list, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 10 });
  if (error) return NextResponse.json({ error: "No se pudieron leer los usuarios" }, { status: 500 });

  const results: Record<string, unknown>[] = [];
  for (const user of list.users) {
    if (!user.email) continue;
    try {
      // Sesión del usuario sin enviar ningún correo: enlace mágico generado y canjeado aquí mismo
      const { data: link, error: linkError } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email: user.email,
      });
      if (linkError || !link.properties?.hashed_token) throw new Error("sin enlace");
      const client = createSupabase<Database>(url, publishable, noSession);
      const { error: otpError } = await client.auth.verifyOtp({
        type: "magiclink",
        token_hash: link.properties.hashed_token,
      });
      if (otpError) throw new Error("sin sesión");
      const supabase = client as unknown as Supabase;
      const market = await refreshMarketData(supabase);
      const nw = await netWorthNow(supabase);
      await saveSnapshot(supabase, nw);
      await client.auth.signOut();
      results.push({ prices: market.prices, fx: market.fx, errors: market.errors.length, snapshot: nw.totalCents > 0 });
    } catch (e) {
      results.push({ error: e instanceof Error ? e.message : "error" });
    }
  }
  return NextResponse.json({ ok: true, users: results.length, results });
}
