import { NextResponse, type NextRequest } from "next/server";
import { fetchFxSeries } from "@/lib/investments/fx";
import { resolveYahooSymbol } from "@/lib/investments/refresh";
import { yahooDailyCloses, yahooSearch } from "@/lib/investments/yahoo";

// Diagnóstico público (sin datos personales): ¿responden las fuentes de precios desde el servidor?
// ?isin=XX...&name=... prueba la búsqueda de símbolo de un valor concreto.
export const dynamic = "force-dynamic";

async function check<T>(fn: () => Promise<T>) {
  try {
    return { ok: true, sample: await fn() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function GET(request: NextRequest) {
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10);
  const isin = request.nextUrl.searchParams.get("isin");
  const name = request.nextUrl.searchParams.get("name")?.slice(0, 60) ?? null;
  if (isin || name) {
    const validIsin = isin && /^[A-Z]{2}[A-Z0-9]{9}\d$/.test(isin) ? isin : null;
    const sp = request.nextUrl.searchParams;
    const price = Number(sp.get("price"));
    const date = sp.get("date");
    const reference = price > 0 && date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? { date, price } : null;
    const currency = /^[A-Z]{3}$/.test(sp.get("currency") ?? "") ? sp.get("currency")! : "EUR";
    return NextResponse.json(
      await check(() =>
        resolveYahooSymbol(
          {
            name: name ?? validIsin ?? "",
            isin: validIsin,
            symbol: null,
            market: null,
            price_symbol: null,
            currency,
            reference,
          },
          to,
        ),
      ),
    );
  }
  const [chart, search, fx] = await Promise.all([
    check(async () => (await yahooDailyCloses("SAN.MC", from, to)).points.length),
    check(async () => (await yahooSearch("IE00B4L5Y983")).slice(0, 2)),
    check(async () => (await fetchFxSeries(["USD"], from, to)).get("USD")?.length ?? 0),
  ]);
  return NextResponse.json({ chart, search, fx });
}
