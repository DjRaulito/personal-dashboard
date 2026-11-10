import type { Metadata } from "next";
import Link from "next/link";
import { formatCompact, formatPercent } from "@/components/content/format";
import { EmptyState, Tile, TileTitle } from "@/components/ui";
import {
  engagementRate,
  PLATFORM_LABEL,
  PLATFORMS,
  STATUS_LABEL,
  sumTotals,
  type PieceStatus,
  type Platform,
} from "@/lib/content/catalog";
import { getContentStats } from "@/lib/content/server";
import { formatCents } from "@/lib/finance/money";

export const metadata: Metadata = { title: "Métricas · Contenido" };

export default async function ContentMetricsPage() {
  const { pieces, totals, revenueByPiece, metricsByPlatform } = await getContentStats();
  const all = sumTotals(totals.values());
  const revenue = [...revenueByPiece.values()].reduce((s, c) => s + c, 0);
  const published = pieces.filter((p) => p.status === "published").length;
  const rows = pieces
    .filter((p) => totals.has(p.id) || revenueByPiece.has(p.id))
    .map((p) => ({ ...p, totals: totals.get(p.id), revenue: revenueByPiece.get(p.id) ?? 0 }))
    .sort((a, b) => (b.totals?.views ?? 0) - (a.totals?.views ?? 0));

  return (
    <>
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-tile bg-content text-ink p-6 sm:col-span-2">
          <p className="text-sm font-medium opacity-80">Visualizaciones</p>
          <p className="font-display mt-1 text-5xl font-extrabold tracking-tight tabular-nums">
            {formatCompact(all.views)}
          </p>
          <p className="mt-2 text-sm opacity-80">
            Interacción {formatPercent(engagementRate(all))} · {formatCompact(all.followers_gained)} seguidores
          </p>
        </div>
        <Tile>
          <p className="text-muted text-sm">Ingresos enlazados</p>
          <p className="font-display mt-1 text-3xl font-extrabold tracking-tight tabular-nums">
            {formatCents(revenue)}
          </p>
        </Tile>
        <Tile>
          <p className="text-muted text-sm">Publicadas</p>
          <p className="font-display mt-1 text-3xl font-extrabold tracking-tight tabular-nums">
            {published}
            <span className="text-muted text-base font-medium"> / {pieces.length}</span>
          </p>
        </Tile>
      </div>

      <Tile>
        <TileTitle dot="bg-content">Por plataforma</TileTitle>
        {metricsByPlatform.size ? (
          <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {PLATFORMS.filter((p) => metricsByPlatform.has(p)).map((p) => {
              const t = metricsByPlatform.get(p)!;
              return (
                <li key={p} className="bg-surface-2 rounded-inner p-4">
                  <p className="text-muted text-sm">{PLATFORM_LABEL[p]}</p>
                  <p className="font-display text-2xl font-extrabold tracking-tight tabular-nums">
                    {formatCompact(t.views)}
                  </p>
                  <p className="text-muted text-xs">
                    {formatCompact(t.likes)} me gusta · {formatPercent(engagementRate(t))} interacción
                  </p>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState>Apunta métricas desde la ficha de cada pieza publicada.</EmptyState>
        )}
      </Tile>

      <Tile>
        <TileTitle dot="bg-content">Por pieza</TileTitle>
        {rows.length ? (
          <div className="-mx-2 mt-3 overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <caption className="sr-only">Métricas e ingresos por pieza</caption>
              <thead className="text-muted text-xs">
                <tr>
                  <th scope="col" className="px-2 py-2 text-left font-medium">
                    Pieza
                  </th>
                  <th scope="col" className="px-2 py-2 text-left font-medium">
                    Plataformas
                  </th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">
                    Vistas
                  </th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">
                    Interacción
                  </th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">
                    Ingresos
                  </th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-2 py-2.5">
                      <Link href={`/contenido/pieza/${r.id}`} className="hover:text-content font-medium">
                        {r.title}
                      </Link>
                      <span className="text-muted block text-xs">{STATUS_LABEL[r.status as PieceStatus]}</span>
                    </td>
                    <td className="text-muted px-2 py-2.5">
                      {r.platforms.map((p) => PLATFORM_LABEL[p as Platform]).join(", ") || "—"}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums">
                      {r.totals ? formatCompact(r.totals.views) : "—"}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums">
                      {r.totals ? formatPercent(engagementRate(r.totals)) : "—"}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{r.revenue ? formatCents(r.revenue) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState>Todavía no hay métricas ni ingresos enlazados.</EmptyState>
        )}
      </Tile>
    </>
  );
}
