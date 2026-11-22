import type { Metadata } from "next";
import { RunsList } from "@/components/tasks/runs-list";
import { LAPTOP_SLUG } from "@/lib/tasks/laptops";
import { getTask } from "@/lib/tasks/server";

export const metadata: Metadata = { title: "Ejecuciones · Portátiles" };

export default async function LaptopRunsPage() {
  const task = await getTask(LAPTOP_SLUG);
  return <RunsList runs={task?.runs ?? []} />;
}
