import { NextResponse } from "next/server";
import { fetchFxSeries } from "@/lib/investments/fx";
import { yahooDailyCloses, yahooSearch } from "@/lib/investments/yahoo";

// Diagnóstico público (sin datos personales): ¿responden las fuentes de precios desde el servidor?
export const dynamic = "force-dynamic";

async function check<T>(fn: () => Promise<T>) {
  try {
    return { ok: true, sample: await fn() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function GET() {
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10);
  const [chart, search, fx] = await Promise.all([
    check(async () => (await yahooDailyCloses("SAN.MC", from, to)).points.length),
    check(async () => (await yahooSearch("IE00B4L5Y983")).slice(0, 2)),
    check(async () => (await fetchFxSeries(["USD"], from, to)).get("USD")?.length ?? 0),
  ]);
  return NextResponse.json({ chart, search, fx });
}
