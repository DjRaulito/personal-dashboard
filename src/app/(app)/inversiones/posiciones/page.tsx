import type { Metadata } from "next";
import Link from "next/link";
import { clsx } from "clsx";
import { AllocationBar } from "@/components/investments/charts";
import { PositionsBoard } from "@/components/investments/positions-board";
import { PriceRefresher } from "@/components/investments/price-refresher";
import { buttonClass, Tile, TileTitle } from "@/components/ui";
import { boardAssets } from "@/lib/investments/board-assets";
import { getPortfolio } from "@/lib/investments/server";
import { KIND_LABELS } from "@/lib/investments/view";

export const metadata: Metadata = { title: "Posiciones · Inversiones" };

const KIND_COLORS: Record<string, string> = {
  fund: "bg-finance",
  stock: "bg-content",
  etf: "bg-nutrition",
  pension: "bg-attention",
  other: "bg-extra",
};

export default async function PositionsPage({ searchParams }: { searchParams: Promise<{ activo?: string }> }) {
  const params = await searchParams;
  const pf = await getPortfolio();
  const board = boardAssets(pf);
  const byKind = new Map<string, number>();
  for (const a of board) if (a.open) byKind.set(a.kind, (byKind.get(a.kind) ?? 0) + a.valueEur);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <PriceRefresher stale={!pf.lastPriceDate || pf.lastPriceDate < pf.today} />
        <details className="relative ml-auto">
          <summary
            className={clsx(buttonClass.secondary, "cursor-pointer list-none [&::-webkit-details-marker]:hidden")}
          >
            Importar / exportar
          </summary>
          <ul className="bg-surface-solid border-border-strong rounded-inner absolute right-0 z-20 mt-1 w-64 overflow-hidden border py-1 shadow-xl">
            <li>
              <Link href="/inversiones/importar" className="hover:bg-surface block px-4 py-2.5 text-sm">
                Importar (Investing, MyInvestor, MEXEM)
              </Link>
            </li>
            <li>
              <a href="/api/investments/export" className="hover:bg-surface block px-4 py-2.5 text-sm">
                Exportar a Investing (CSV)
              </a>
            </li>
          </ul>
        </details>
      </div>

      <PositionsBoard assets={board} today={pf.today} initialAssetId={params.activo ?? null} />

      {byKind.size > 0 && (
        <Tile>
          <TileTitle>Reparto por tipo</TileTitle>
          <div className="mt-4">
            <AllocationBar
              parts={[...byKind.entries()].map(([kind, v]) => ({
                label: KIND_LABELS[kind as keyof typeof KIND_LABELS],
                value: v,
                className: KIND_COLORS[kind] ?? "bg-extra",
              }))}
            />
          </div>
        </Tile>
      )}
    </>
  );
}
