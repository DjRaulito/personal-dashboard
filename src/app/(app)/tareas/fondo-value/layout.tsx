import { notFound } from "next/navigation";
import { SectionTabs } from "@/components/section-tabs";
import { RunSummary } from "@/components/tasks/runs-list";
import { FUND_BASE, fundRows } from "@/components/tasks/fund-views";
import { FUND_SLUG } from "@/lib/tasks/fund";
import { getTask } from "@/lib/tasks/server";

export default async function FundLayout({ children }: { children: React.ReactNode }) {
  const task = await getTask(FUND_SLUG);
  if (!task) notFound();
  const rows = fundRows(task.items.filter((i) => !i.removedAt));
  const unseen = (state: string) => rows.filter((r) => r.p.state === state && r.item.status === "new").length;
  return (
    <div className="flex flex-col gap-3.5">
      <RunSummary task={task} />
      <SectionTabs
        label="Fondo value"
        tabs={[
          { href: FUND_BASE, label: "Cartera", exact: true, count: unseen("cartera") },
          { href: `${FUND_BASE}/vigilancia`, label: "Vigilancia", count: unseen("vigilancia") },
          { href: `${FUND_BASE}/ejecuciones`, label: "Ejecuciones" },
        ]}
      />
      {children}
    </div>
  );
}
