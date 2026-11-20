import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { dayKey } from "@/lib/datetime";
import { historyFrom, historyWindow, parseHistoryRange } from "@/lib/investments/history";
import { dailyCloses } from "@/lib/investments/refresh";
import { createClient } from "@/lib/supabase/server";

/**
 * Evolución del precio de un activo en un periodo (1D a 5A). Para 3A y 5A pide el histórico
 * largo a la fuente aunque la compra sea reciente; si no hay fuente, usa los precios guardados.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });

  const id = z.string().uuid().safeParse(req.nextUrl.searchParams.get("activo"));
  if (!id.success) return NextResponse.json({ error: "Activo no válido" }, { status: 400 });
  const range = parseHistoryRange(req.nextUrl.searchParams.get("rango"));
  const today = dayKey(new Date());
  const from = historyFrom(range, today);

  const { data: asset } = await supabase
    .from("assets")
    .select("price_source, price_symbol")
    .eq("id", id.data)
    .maybeSingle();
  if (!asset) return NextResponse.json({ error: "No existe" }, { status: 404 });

  let points: { date: string; value: number }[] = [];
  let source: "remote" | "stored" = "stored";
  if (asset.price_source !== "manual" && asset.price_symbol) {
    try {
      points = (await dailyCloses(asset.price_symbol, from, today)).points;
      source = "remote";
    } catch {
      points = [];
    }
  }
  if (points.length === 0) {
    const { data } = await supabase
      .from("asset_prices")
      .select("price_date, close")
      .eq("asset_id", id.data)
      .gte("price_date", from)
      .order("price_date")
      .limit(2000);
    points = (data ?? []).map((p) => ({ date: p.price_date, value: Number(p.close) }));
    source = "stored";
  }
  const result = historyWindow(points, range, today);
  return NextResponse.json({ ...result, source }, { headers: { "Cache-Control": "private, max-age=900" } });
}
