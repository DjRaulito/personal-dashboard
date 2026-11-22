import { notFound } from "next/navigation";
import { SectionTabs } from "@/components/section-tabs";
import { LAPTOP_BASE, laptopRows } from "@/components/tasks/laptop-views";
import { RunSummary } from "@/components/tasks/runs-list";
import { LAPTOP_SLUG } from "@/lib/tasks/laptops";
import { getTask } from "@/lib/tasks/server";

export default async function LaptopsLayout({ children }: { children: React.ReactNode }) {
  const task = await getTask(LAPTOP_SLUG);
  if (!task) notFound();
  const rows = laptopRows(
    task.items.filter((i) => !i.removedAt && i.status !== "discarded"),
    Date.now(),
  );
  const unseen = (list: typeof rows) => list.filter((r) => r.item.status === "new").length;
  return (
    <div className="flex flex-col gap-3.5">
      <RunSummary task={task} />
      <SectionTabs
        label="Ofertas de portátiles"
        tabs={[
          { href: LAPTOP_BASE, label: "Posibilidades", exact: true, count: unseen(rows) },
          { href: `${LAPTOP_BASE}/oferta`, label: "En oferta", count: unseen(rows.filter((r) => r.onSale)) },
          { href: `${LAPTOP_BASE}/ejecuciones`, label: "Ejecuciones" },
        ]}
      />
      {children}
    </div>
  );
}
