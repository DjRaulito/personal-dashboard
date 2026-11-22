import type { Metadata } from "next";
import Link from "next/link";
import { LAPTOP_BASE, LaptopGrid, laptopRows } from "@/components/tasks/laptop-views";
import { LAPTOP_SLUG } from "@/lib/tasks/laptops";
import { getTask } from "@/lib/tasks/server";

export const metadata: Metadata = { title: "Posibilidades · Portátiles" };

export default async function LaptopsPage({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  const task = await getTask(LAPTOP_SLUG);
  const discarded = (await searchParams).ver === "descartados";
  const items = task?.items ?? [];
  const now = Date.now();
  const rows = laptopRows(
    items.filter((i) => (discarded ? i.status === "discarded" : i.status !== "discarded")),
    now,
  );
  const hidden = items.filter((i) => i.status === "discarded").length;
  return (
    <>
      <LaptopGrid
        rows={rows}
        now={now}
        empty={discarded ? "No has descartado ninguno." : "La tarea aún no ha guardado portátiles."}
      />
      {(hidden > 0 || discarded) && (
        <Link
          href={discarded ? LAPTOP_BASE : `${LAPTOP_BASE}?ver=descartados`}
          className="text-muted hover:text-text self-start text-sm underline-offset-2 hover:underline"
        >
          {discarded ? "← Volver a las posibilidades" : `Ver descartados (${hidden})`}
        </Link>
      )}
    </>
  );
}
