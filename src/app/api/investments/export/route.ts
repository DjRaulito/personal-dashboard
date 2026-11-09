import { NextResponse, type NextRequest } from "next/server";
import { investingCsv } from "@/lib/investments/investing-export";
import { getPortfolio } from "@/lib/investments/server";
import { createClient } from "@/lib/supabase/server";

/** CSV de posiciones abiertas para importar en Investing.com. ?desde=YYYY-MM-DD para solo lo nuevo. */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });

  const since = request.nextUrl.searchParams.get("desde");
  const pf = await getPortfolio();
  const { csv } = investingCsv(pf.input, pf.assets, {
    since: since && /^\d{4}-\d{2}-\d{2}$/.test(since) ? since : undefined,
  });
  return new NextResponse(`﻿${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="investing-posiciones-${pf.today}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
