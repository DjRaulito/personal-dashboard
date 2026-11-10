"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { clsx } from "clsx";
import { movePiece } from "@/app/(app)/contenido/actions";
import {
  FORMAT_LABEL,
  PLATFORM_LABEL,
  STATUS_LABEL,
  STATUSES,
  type PieceFormat,
  type PieceStatus,
  type Platform,
} from "@/lib/content/catalog";
import { formatShortDate } from "./format";

export interface BoardPiece {
  id: string;
  title: string;
  status: PieceStatus;
  format: PieceFormat;
  platforms: Platform[];
  priority: number;
  publish_at: string | null;
  hasVideo: boolean;
}

interface Move {
  id: string;
  status: PieceStatus;
  index: number;
}

/** Aplica un movimiento a la lista: quita la ficha y la inserta en su columna en la posición dada. */
function applyMove(pieces: BoardPiece[], move: Move): BoardPiece[] {
  const piece = pieces.find((p) => p.id === move.id);
  if (!piece) return pieces;
  const rest = pieces.filter((p) => p.id !== move.id);
  const column = rest.filter((p) => p.status === move.status);
  const anchor = column[move.index] ?? null;
  const moved = { ...piece, status: move.status };
  if (!anchor) {
    const lastOfColumn = column.at(-1);
    const at = lastOfColumn ? rest.indexOf(lastOfColumn) + 1 : rest.length;
    return [...rest.slice(0, at), moved, ...rest.slice(at)];
  }
  const at = rest.indexOf(anchor);
  return [...rest.slice(0, at), moved, ...rest.slice(at)];
}

export function ContentBoard({ pieces }: { pieces: BoardPiece[] }) {
  const [optimistic, setOptimistic] = useOptimistic(pieces, applyMove);
  const [, startTransition] = useTransition();
  const [dragging, setDragging] = useState<string | null>(null);
  const [drop, setDrop] = useState<{ status: PieceStatus; index: number } | null>(null);
  const [error, setError] = useState(false);

  function commit(move: Move) {
    const next = applyMove(optimistic, move);
    const column = next.filter((p) => p.status === move.status);
    const at = column.findIndex((p) => p.id === move.id);
    startTransition(async () => {
      setOptimistic(move);
      const result = await movePiece({
        id: move.id,
        status: move.status,
        beforeId: column[at - 1]?.id ?? null,
        afterId: column[at + 1]?.id ?? null,
      });
      setError(!result.ok);
    });
  }

  function moveBy(piece: BoardPiece, delta: -1 | 1) {
    const target = STATUSES[STATUSES.indexOf(piece.status) + delta];
    if (!target) return;
    commit({ id: piece.id, status: target, index: optimistic.filter((p) => p.status === target).length });
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p role="alert" className="bg-surface-2 rounded-inner text-attention px-3.5 py-2.5 text-sm">
          No se pudo mover la ficha. Recarga la página y vuelve a probar.
        </p>
      )}
      <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        <ol className="grid w-max auto-cols-[minmax(15rem,1fr)] grid-flow-col gap-3 xl:w-full xl:auto-cols-[minmax(0,1fr)] xl:gap-2">
          {STATUSES.map((status) => {
            const column = optimistic.filter((p) => p.status === status);
            const over = drop?.status === status;
            return (
              <li
                key={status}
                aria-label={`${STATUS_LABEL[status]}: ${column.length}`}
                onDragOver={(e) => {
                  if (!dragging) return;
                  e.preventDefault();
                  // Sobre la columna vacía o debajo de la última ficha: al final
                  if (e.target === e.currentTarget) setDrop({ status, index: column.length });
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setDrop(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragging && drop) commit({ id: dragging, status: drop.status, index: drop.index });
                  setDragging(null);
                  setDrop(null);
                }}
                className={clsx(
                  "rounded-inner bg-surface-2/60 flex min-h-48 flex-col gap-2 border p-2 transition-colors duration-150",
                  over ? "border-content" : "border-transparent",
                )}
              >
                <h3 className="text-muted flex items-center justify-between px-1.5 pt-1 text-xs font-semibold tracking-wide uppercase">
                  {STATUS_LABEL[status]}
                  <span className="tabular-nums">{column.length}</span>
                </h3>
                <ul className="flex flex-col gap-2">
                  {column.map((piece, index) => (
                    <li
                      key={piece.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", piece.id);
                        setDragging(piece.id);
                      }}
                      onDragEnd={() => {
                        setDragging(null);
                        setDrop(null);
                      }}
                      onDragOver={(e) => {
                        if (!dragging) return;
                        e.preventDefault();
                        const box = e.currentTarget.getBoundingClientRect();
                        const after = e.clientY > box.top + box.height / 2;
                        setDrop({ status, index: index + (after ? 1 : 0) });
                      }}
                      className={clsx(
                        "group relative",
                        dragging === piece.id && "opacity-40",
                        over &&
                          drop?.index === index &&
                          "before:bg-content before:absolute before:inset-x-2 before:-top-1.5 before:h-0.5 before:rounded-full",
                        over &&
                          drop?.index === index + 1 &&
                          index === column.length - 1 &&
                          "after:bg-content after:absolute after:inset-x-2 after:-bottom-1.5 after:h-0.5 after:rounded-full",
                      )}
                    >
                      <Card piece={piece} onMove={(d) => moveBy(piece, d)} />
                    </li>
                  ))}
                </ul>
                {column.length === 0 && <p className="text-muted px-1.5 py-4 text-center text-xs">Suelta aquí</p>}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

function Card({ piece, onMove }: { piece: BoardPiece; onMove: (delta: -1 | 1) => void }) {
  const first = piece.status === STATUSES[0];
  const last = piece.status === STATUSES[STATUSES.length - 1];
  return (
    <article className="bg-surface border-border rounded-inner flex cursor-grab flex-col gap-2 border p-3 active:cursor-grabbing">
      <Link
        href={`/contenido/pieza/${piece.id}`}
        className="hover:text-content focus-visible:outline-content text-sm leading-snug font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
        draggable={false}
      >
        {piece.priority === 1 && <span className="sr-only">Prioridad alta: </span>}
        {piece.title}
      </Link>
      <div className="text-muted flex flex-wrap items-center gap-1.5 text-xs">
        {piece.priority === 1 && <span aria-hidden="true" className="bg-attention h-1.5 w-1.5 rounded-full" />}
        <span>{FORMAT_LABEL[piece.format]}</span>
        {piece.platforms.length > 0 && <span>· {piece.platforms.map((p) => PLATFORM_LABEL[p]).join(", ")}</span>}
        {piece.publish_at && <span>· {formatShortDate(piece.publish_at)}</span>}
        {piece.hasVideo && <span className="text-content">· vídeo</span>}
      </div>
      <div className="flex justify-end gap-1 md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:focus-within:opacity-100">
        <button
          type="button"
          disabled={first}
          onClick={() => onMove(-1)}
          aria-label={`Mover «${piece.title}» a la columna anterior`}
          className="text-muted hover:bg-surface-2 hover:text-text focus-visible:outline-content rounded-full px-2 py-0.5 text-sm focus-visible:outline-2 disabled:invisible"
        >
          ←
        </button>
        <button
          type="button"
          disabled={last}
          onClick={() => onMove(1)}
          aria-label={`Mover «${piece.title}» a la columna siguiente`}
          className="text-muted hover:bg-surface-2 hover:text-text focus-visible:outline-content rounded-full px-2 py-0.5 text-sm focus-visible:outline-2 disabled:invisible"
        >
          →
        </button>
      </div>
    </article>
  );
}
