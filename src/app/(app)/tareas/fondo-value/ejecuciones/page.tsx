import type { Metadata } from "next";
import { RunsList } from "@/components/tasks/runs-list";
import { FUND_SLUG } from "@/lib/tasks/fund";
import { getTask } from "@/lib/tasks/server";

export const metadata: Metadata = { title: "Ejecuciones · Fondo value" };

export default async function FundRunsPage() {
  const task = await getTask(FUND_SLUG);
  return <RunsList runs={task?.runs ?? []} noun="ideas nuevas" />;
}
