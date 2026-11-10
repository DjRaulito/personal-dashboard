import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { clsx } from "clsx";
import { z } from "zod";
import { Markdown } from "@/components/ai/markdown";
import { LiveRefresh } from "@/components/agents/live-refresh";
import { ActionDecision, CancelRunButton } from "@/components/agents/run-controls";
import { shortDateTime, StatusBadge } from "@/components/agents/status";
import { BackLink, EmptyState, Tile, TileTitle } from "@/components/ui";
import { ENGINES, type Engine } from "@/lib/agents/catalog";
import { getRun } from "@/lib/agents/server";
import { APP_LOCALE, APP_TIMEZONE } from "@/lib/datetime";

export const metadata: Metadata = { title: "Ejecución" };
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const time = (iso: string) =>
  new Intl.DateTimeFormat(APP_LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: APP_TIMEZONE,
  }).format(new Date(iso));

const ACTION_STATUS: Record<string, string> = {
  pending: "Pendiente",
  approved: "Aprobada",
  rejected: "Rechazada",
  failed: "Falló",
};

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const detail = await getRun(id);
  if (!detail) notFound();
  const { run, prompt, logs, actions } = detail;
  const live = run.status === "queued" || run.status === "working";
  const cancellable = live || run.status === "waiting_approval";

  return (
    <div className="flex flex-col gap-3.5">
      <LiveRefresh active={live} />
      <BackLink href="/ia/agentes">Agentes</BackLink>

      <Tile>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-2xl font-bold">{run.agent_name}</h2>
            <p className="text-muted mt-1 text-sm">
              {ENGINES[run.engine as Engine]?.label} · {shortDateTime(run.created_at)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={run.status} />
            {cancellable && <CancelRunButton runId={run.id} />}
          </div>
        </div>
        <p className="bg-surface-2 rounded-inner mt-4 px-3.5 py-3 text-sm whitespace-pre-wrap">{prompt}</p>
        {run.github_url && (
          <p className="mt-3 text-sm">
            <a
              href={run.github_url}
              target="_blank"
              rel="noreferrer"
              className="text-content underline underline-offset-2"
            >
              Ver en GitHub Actions
            </a>
          </p>
        )}
      </Tile>

      {actions.length > 0 && (
        <Tile>
          <TileTitle dot="bg-attention">Propuestas</TileTitle>
          <ul className="mt-4 flex flex-col gap-3">
            {actions.map((a) => (
              <li key={a.id} className="bg-surface-2 rounded-inner flex flex-col gap-2.5 p-3.5">
                <p className="text-sm">{a.summary}</p>
                {a.status === "pending" ? (
                  <ActionDecision actionId={a.id} />
                ) : (
                  <p className={clsx("text-xs", a.status === "failed" ? "text-expense" : "text-muted")}>
                    {ACTION_STATUS[a.status] ?? a.status}
                    {a.outcome && ` · ${a.outcome}`}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Tile>
      )}

      <Tile>
        <TileTitle dot="bg-content">Resultado</TileTitle>
        <div className="mt-4 text-sm">
          {run.result ? (
            <Markdown text={run.result} />
          ) : run.error ? (
            <p className="text-expense">{run.error}</p>
          ) : (
            <EmptyState>{live ? "El agente está trabajando…" : "Sin resultado."}</EmptyState>
          )}
        </div>
      </Tile>

      <Tile>
        <TileTitle dot="bg-muted">Registro</TileTitle>
        {logs.length ? (
          <ol className="mt-4 flex flex-col gap-1.5 text-sm" aria-live="polite">
            {logs.map((l) => (
              <li key={l.id} className="flex gap-3">
                <span className="text-muted shrink-0 text-xs tabular-nums">{time(l.created_at)}</span>
                <span className={clsx(l.kind === "error" && "text-expense", l.kind === "tool" && "text-muted")}>
                  {l.message}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState>{run.status === "queued" ? "En cola, esperando hueco." : "Sin registro."}</EmptyState>
        )}
      </Tile>
    </div>
  );
}
