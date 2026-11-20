import "server-only";
import { dayKey } from "@/lib/datetime";
import { getPortfolio } from "@/lib/investments/server";
import { positionRows } from "@/lib/investments/view";
import type { createClient } from "@/lib/supabase/server";
import { getAccounts } from "./server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export interface NetWorthNow {
  cashCents: number;
  investmentsCents: number;
  totalCents: number;
}

/** Patrimonio de ahora: saldo de las cuentas + valor de la cartera. */
export async function netWorthNow(client?: Supabase): Promise<NetWorthNow> {
  const [accounts, pf] = await Promise.all([getAccounts(client), getPortfolio(client)]);
  const cashCents = accounts.reduce((s, a) => s + a.balance_cents, 0);
  const rows = positionRows(pf.input, pf.positions, pf.assets);
  const investmentsCents = Math.round(rows.reduce((s, r) => s + r.valueEur, 0) * 100);
  return { cashCents, investmentsCents, totalCents: cashCents + investmentsCents };
}

/** Guarda (o corrige) la foto de hoy del patrimonio. */
export async function saveSnapshot(supabase: Supabase, nw: NetWorthNow, day = dayKey(new Date())) {
  if (nw.totalCents === 0) return;
  await supabase
    .from("net_worth_snapshots")
    .upsert({ day, cash_cents: nw.cashCents, investments_cents: nw.investmentsCents }, { onConflict: "user_id,day" });
}
