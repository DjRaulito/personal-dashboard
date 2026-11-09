import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { clsx } from "clsx";
import { AssetSettings } from "@/components/investments/asset-settings";
import { OperationsTable } from "@/components/investments/operations-table";
import { Tile, TileTitle } from "@/components/ui";
import { formatCents } from "@/lib/finance/money";
import { getPortfolio } from "@/lib/investments/server";
import { KIND_LABELS } from "@/lib/investments/view";

export const metadata: Metadata = { title: "Activo · Inversiones" };

const eur = (v: number, signed = false) => formatCents(Math.round(v * 100), "EUR", { signed });

export default async function AssetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pf = await getPortfolio();
  const asset = pf.assets.find((a) => a.id === id);
  if (!asset) notFound();
  const p = pf.positions.get(id);
  const ops = pf.operations.filter((o) => o.assetId === id).reverse();
  const prices = pf.input.prices.get(id) ?? [];
  const gain = p ? p.valueEur - p.costEur : 0;

  const stats = [
    { label: "Títulos", value: p?.quantity ? p.quantity.toLocaleString("es-ES", { maximumFractionDigits: 6 }) : "0" },
    { label: "Valor", value: eur(p?.valueEur ?? 0) },
    { label: "Coste (FIFO)", value: eur(p?.costEur ?? 0) },
    { label: "Plusvalía latente", value: eur(gain, true), tone: gain },
    { label: "Plusvalía realizada", value: eur(p?.realizedEur ?? 0, true), tone: p?.realizedEur ?? 0 },
    { label: "Dividendos", value: eur(p?.dividendsEur ?? 0) },
  ];

  return (
    <>
      <Tile>
        <Link href="/finanzas/inversiones" className="text-muted hover:text-text text-sm">
          ← Inversiones
        </Link>
        <h1 className="font-display mt-3 text-3xl font-extrabold tracking-tight">{asset.name}</h1>
        <p className="text-muted mt-1 text-sm">
          {KIND_LABELS[asset.kind]} · {asset.isin ?? asset.symbol ?? "sin ISIN"} · {asset.currency}
          {prices.length > 0 &&
            ` · último precio ${prices.at(-1)!.value.toLocaleString("es-ES", { maximumFractionDigits: 4 })} (${prices.at(-1)!.date})`}
        </p>
        <dl className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {stats.map((s) => (
            <div key={s.label} className="bg-surface-2 rounded-inner px-3 py-3">
              <dt className="text-muted text-xs">{s.label}</dt>
              <dd
                className={clsx(
                  "mt-1 font-semibold tabular-nums",
                  s.tone == null ? "" : s.tone > 0 ? "text-finance" : s.tone < 0 ? "text-expense" : "",
                )}
              >
                {s.value}
              </dd>
            </div>
          ))}
        </dl>
      </Tile>
      <Tile>
        <TileTitle>Operaciones</TileTitle>
        <div className="mt-4">
          <OperationsTable
            showAsset={false}
            rows={ops.map((o) => ({
              id: o.id,
              date: o.date,
              type: o.type,
              quantity: o.quantity,
              price: o.price,
              currency: asset.currency,
              cashEur: o.cashEur,
              isSplit: o.isSplit,
              source: o.source,
            }))}
          />
        </div>
      </Tile>
      <Tile>
        <TileTitle>Ajustes del activo</TileTitle>
        <div className="mt-4">
          <AssetSettings asset={asset} today={pf.today} />
        </div>
      </Tile>
    </>
  );
}
