import { NextResponse } from "next/server";
import { refreshMarketData } from "@/lib/investments/refresh";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

/** Actualiza precios y tipos de cambio de la cartera del usuario con sesión. */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  const result = await refreshMarketData(supabase);
  return NextResponse.json(result);
}
