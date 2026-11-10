import type { Metadata } from "next";
import Link from "next/link";
import { ContentBoard, type BoardPiece } from "@/components/content/board";
import { buttonClass, EmptyState, Tile, TileTitle } from "@/components/ui";
import type { PieceFormat, PieceStatus, Platform } from "@/lib/content/catalog";
import { contentSession, getPieces } from "@/lib/content/server";

export const metadata: Metadata = { title: "Contenido" };

export default async function ContentBoardPage() {
  const supabase = await contentSession();
  const [pieces, { data: videos }] = await Promise.all([
    getPieces(),
    supabase.from("video_jobs").select("piece_id").in("status", ["ready", "approved"]).not("piece_id", "is", null),
  ]);
  const withVideo = new Set((videos ?? []).map((v) => v.piece_id));
  const board: BoardPiece[] = pieces.map((p) => ({
    id: p.id,
    title: p.title,
    status: p.status as PieceStatus,
    format: p.format as PieceFormat,
    platforms: p.platforms as Platform[],
    priority: p.priority,
    publish_at: p.publish_at,
    hasVideo: withVideo.has(p.id),
  }));

  return (
    <Tile className="p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <TileTitle dot="bg-content">Tablero</TileTitle>
        <Link href="/contenido/pieza/nueva" className={buttonClass.secondary}>
          Nueva pieza
        </Link>
      </div>
      {board.length ? (
        <ContentBoard pieces={board} />
      ) : (
        <EmptyState>
          Aún no hay piezas. Apunta ideas en{" "}
          <Link href="/contenido/ideas" className="underline">
            Ideas
          </Link>{" "}
          o crea una pieza nueva.
        </EmptyState>
      )}
    </Tile>
  );
}
