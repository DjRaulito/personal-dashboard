import type { Metadata } from "next";
import { LaptopGrid, laptopRows } from "@/components/tasks/laptop-views";
import { LAPTOP_SLUG } from "@/lib/tasks/laptops";
import { getTask } from "@/lib/tasks/server";

export const metadata: Metadata = { title: "En oferta · Portátiles" };

export default async function LaptopDealsPage() {
  const task = await getTask(LAPTOP_SLUG);
  const now = Date.now();
  const rows = laptopRows(
    (task?.items ?? []).filter((i) => !i.removedAt && i.status !== "discarded"),
    now,
  ).filter((r) => r.onSale);
  return (
    <>
      <p className="text-muted text-sm">
        Los que la tarea marca como oferta, los que están por debajo de su precio de referencia y los que han bajado
        esta semana.
      </p>
      <LaptopGrid rows={rows} now={now} empty="Hoy no hay ninguno en oferta." />
    </>
  );
}
