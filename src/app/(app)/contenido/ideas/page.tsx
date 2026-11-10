import type { Metadata } from "next";
import Link from "next/link";
import { clsx } from "clsx";
import { QuickIdea } from "@/components/content/quick-idea";
import { EmptyState, Tile, TileTitle } from "@/components/ui";
import {
  FORMAT_LABEL,
  FORMATS,
  PLATFORM_LABEL,
  PRIORITY_LABEL,
  type PieceFormat,
  type Platform,
} from "@/lib/content/catalog";
import { getPieces } from "@/lib/content/server";

export const metadata: Metadata = { title: "Ideas · Contenido" };

export default async function IdeasPage({ searchParams }: { searchParams: Promise<{ formato?: string }> }) {
  const { formato } = await searchParams;
  const filter = FORMATS.includes(formato as PieceFormat) ? (formato as PieceFormat) : null;
  const ideas = (await getPieces())
    .filter((p) => p.status === "idea" && (!filter || p.format === filter))
    .sort((a, b) => a.priority - b.priority || b.created_at.localeCompare(a.created_at));

  return (
    <>
      <Tile>
        <TileTitle dot="bg-content">Apuntar una idea</TileTitle>
        <p className="text-muted mt-1 text-sm">
          Entra en la columna «Idea» del tablero. El piloto automático del VoiceStudio coge las de prioridad alta
          primero.
        </p>
        <div className="mt-4">
          <QuickIdea />
        </div>
      </Tile>

      <Tile>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TileTitle dot="bg-content">Banco de ideas</TileTitle>
          <nav aria-label="Filtrar por formato" className="flex flex-wrap gap-1.5">
            {[null, ...FORMATS].map((f) => (
              <Link
                key={f ?? "todas"}
                href={f ? `/contenido/ideas?formato=${f}` : "/contenido/ideas"}
                aria-current={filter === f ? "page" : undefined}
                className={clsx(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150",
                  filter === f ? "bg-content text-ink" : "bg-surface-2 text-muted hover:text-text",
                )}
              >
                {f ? FORMAT_LABEL[f] : "Todas"}
              </Link>
            ))}
          </nav>
        </div>
        {ideas.length ? (
          <ul className="divide-border mt-3 divide-y">
            {ideas.map((idea) => (
              <li key={idea.id}>
                <Link
                  href={`/contenido/pieza/${idea.id}`}
                  className="hover:bg-surface-2 rounded-inner -mx-2 flex flex-wrap items-center gap-x-3 gap-y-1 px-2 py-3 transition-colors duration-150"
                >
                  <span
                    aria-hidden="true"
                    className={clsx(
                      "h-2 w-2 shrink-0 rounded-full",
                      idea.priority === 1 ? "bg-attention" : idea.priority === 2 ? "bg-content" : "bg-border-strong",
                    )}
                  />
                  <span className="min-w-0 flex-1 font-medium">{idea.title}</span>
                  <span className="text-muted text-xs">
                    {FORMAT_LABEL[idea.format as PieceFormat]}
                    {idea.platforms.length > 0 &&
                      ` · ${idea.platforms.map((p) => PLATFORM_LABEL[p as Platform]).join(", ")}`}
                    {" · "}
                    Prioridad {PRIORITY_LABEL[idea.priority].toLowerCase()}
                  </span>
                  {idea.tags.length > 0 && (
                    <span className="flex basis-full flex-wrap gap-1 pl-5">
                      {idea.tags.map((t) => (
                        <span key={t} className="bg-surface-2 text-muted rounded-full px-2 py-0.5 text-xs">
                          {t}
                        </span>
                      ))}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState>
            {filter ? "No hay ideas de este formato." : "El banco está vacío. Apunta la primera arriba."}
          </EmptyState>
        )}
      </Tile>
    </>
  );
}
