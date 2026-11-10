import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { MetricForm, MetricList } from "@/components/content/metric-form";
import { PieceForm } from "@/components/content/piece-form";
import { RevenueLinks } from "@/components/content/revenue-links";
import { toLocalInput } from "@/components/content/format";
import { BackLink, Tile, TileTitle } from "@/components/ui";
import { aiConfigured } from "@/lib/ai/llm";
import type { PieceFormat, PieceStatus, Platform } from "@/lib/content/catalog";
import { getLinkableTransactions, getPiece } from "@/lib/content/server";
import { dayKey } from "@/lib/datetime";
import { CALENDAR_WRITE_SCOPE } from "@/lib/google/calendar";
import { hasGoogleScope } from "@/lib/google/server";

export const metadata: Metadata = { title: "Pieza · Contenido" };

export default async function PiecePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [detail, candidates, canWriteCalendar] = await Promise.all([
    getPiece(id),
    getLinkableTransactions(),
    hasGoogleScope(CALENDAR_WRITE_SCOPE),
  ]);
  if (!detail) notFound();
  const { piece, metrics, transactions } = detail;
  const platforms = piece.platforms as Platform[];

  return (
    <>
      <BackLink href="/contenido">Tablero</BackLink>
      <div className="grid items-start gap-3.5 lg:grid-cols-5">
        <Tile className="lg:col-span-3">
          <TileTitle dot="bg-content">Ficha</TileTitle>
          {piece.publish_at && !canWriteCalendar && (
            <p className="bg-surface-2 rounded-inner text-attention mt-3 px-3.5 py-2.5 text-sm">
              La fecha no llega a Google Calendar: cierra sesión y vuelve a entrar con Google para dar el permiso de
              escritura.
            </p>
          )}
          <div className="mt-5">
            {/* key: si la IA reescribe el guion, el formulario se recarga con el texto nuevo */}
            <PieceForm
              key={piece.updated_at}
              aiReady={aiConfigured()}
              piece={{
                id: piece.id,
                title: piece.title,
                status: piece.status as PieceStatus,
                format: piece.format as PieceFormat,
                platforms,
                priority: piece.priority,
                tags: piece.tags,
                script: piece.script ?? "",
                notes: piece.notes ?? "",
                links: piece.links,
                publish_at: toLocalInput(piece.publish_at),
                published_url: piece.published_url ?? "",
              }}
            />
          </div>
        </Tile>

        <div className="flex flex-col gap-3.5 lg:col-span-2">
          <Tile>
            <TileTitle dot="bg-finance">Ingresos</TileTitle>
            <div className="mt-3">
              <RevenueLinks pieceId={piece.id} linked={transactions} candidates={candidates} />
            </div>
          </Tile>
          <Tile>
            <TileTitle dot="bg-content">Métricas</TileTitle>
            <div className="mt-3 flex flex-col gap-4">
              <MetricList
                pieceId={piece.id}
                metrics={metrics.map((m) => ({ ...m, platform: m.platform as Platform }))}
              />
              <MetricForm pieceId={piece.id} platforms={platforms} today={dayKey(new Date())} />
            </div>
          </Tile>
        </div>
      </div>
    </>
  );
}
