import type { Metadata } from "next";
import Link from "next/link";
import { OperationForm } from "@/components/investments/operation-form";
import { OperationsTable } from "@/components/investments/operations-table";
import { EmptyState, Tile, TileTitle } from "@/components/ui";
import { getPortfolio } from "@/lib/investments/server";

export const metadata: Metadata = { title: "Operaciones · Inversiones" };

export default async function OperationsPage() {
  const pf = await getPortfolio();
  const byId = new Map(pf.assets.map((a) => [a.id, a]));
  const rows = [...pf.operations].reverse().map((o) => ({
    id: o.id,
    date: o.date,
    assetName: byId.get(o.assetId)?.name,
    type: o.type,
    quantity: o.quantity,
    price: o.price,
    currency: byId.get(o.assetId)?.currency ?? "EUR",
    cashEur: o.cashEur,
    isSplit: o.isSplit,
    source: o.source,
  }));

  return (
    <>
      <Tile>
        <Link href="/finanzas/inversiones" className="text-muted hover:text-text text-sm">
          ← Inversiones
        </Link>
        <details className="mt-3">
          <summary className="cursor-pointer font-semibold select-none">Añadir operación a mano</summary>
          <div className="mt-4">
            {pf.assets.length ? (
              <OperationForm assets={pf.assets.map((a) => ({ id: a.id, name: a.name }))} today={pf.today} />
            ) : (
              <p className="text-muted text-sm">Importa primero tu cartera para tener activos.</p>
            )}
          </div>
        </details>
      </Tile>
      <Tile>
        <TileTitle>Operaciones ({rows.length})</TileTitle>
        <div className="mt-4">
          {rows.length ? <OperationsTable rows={rows} /> : <EmptyState>Sin operaciones todavía.</EmptyState>}
        </div>
      </Tile>
    </>
  );
}
