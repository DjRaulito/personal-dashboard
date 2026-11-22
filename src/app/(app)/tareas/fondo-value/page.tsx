import type { Metadata } from "next";
import { FundList, fundRows, Stat, signTone } from "@/components/tasks/fund-views";
import { Tile } from "@/components/ui";
import { average, formatPct, FUND_SLUG, sinceBuy, upside } from "@/lib/tasks/fund";
import { getTask } from "@/lib/tasks/server";

export const metadata: Metadata = { title: "Cartera · Fondo value" };

export default async function FundPortfolioPage() {
  const task = await getTask(FUND_SLUG);
  const rows = fundRows((task?.items ?? []).filter((i) => !i.removedAt)).filter((r) => r.p.state === "cartera");
  // Más peso primero; a igualdad, más recorrido
  rows.sort((a, b) => (b.p.weight ?? 0) - (a.p.weight ?? 0) || (upside(b.p) ?? 0) - (upside(a.p) ?? 0));
  const ret = average(rows.map((r) => sinceBuy(r.p)));
  const up = average(rows.map((r) => upside(r.p)));
  const ev = average(rows.map((r) => r.p.ev));
  const invested = rows.reduce((s, r) => s + (r.p.weight ?? 0), 0);
  const now = Date.now();
  return (
    <>
      {rows.length > 0 && (
        <Tile>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Empresas" value={String(rows.length)} big hint={`${formatPct(invested, false)} invertido`} />
            <Stat label="Rentabilidad media" value={formatPct(ret)} tone={signTone(ret)} big hint="desde la compra" />
            <Stat label="Revalorización media" value={formatPct(up)} tone={signTone(up)} big hint="hasta la salida" />
            <Stat label="EV medio" value={formatPct(ev)} big hint="valor esperado a 12-24 meses" />
          </dl>
        </Tile>
      )}
      <FundList rows={rows} kind="cartera" now={now} />
    </>
  );
}
