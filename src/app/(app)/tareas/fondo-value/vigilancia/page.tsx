import type { Metadata } from "next";
import { FundList, fundRows } from "@/components/tasks/fund-views";
import { FUND_SLUG, toEntry } from "@/lib/tasks/fund";
import { getTask } from "@/lib/tasks/server";

export const metadata: Metadata = { title: "Vigilancia · Fondo value" };

export default async function FundWatchPage() {
  const task = await getTask(FUND_SLUG);
  const rows = fundRows((task?.items ?? []).filter((i) => !i.removedAt)).filter((r) => r.p.state === "vigilancia");
  // Las más cerca de su precio de entrada primero
  rows.sort((a, b) => (toEntry(b.p) ?? -Infinity) - (toEntry(a.p) ?? -Infinity));
  const now = Date.now();
  return <FundList rows={rows} kind="vigilancia" now={now} />;
}
