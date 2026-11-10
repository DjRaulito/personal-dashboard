import type { Metadata } from "next";
import Link from "next/link";
import { LiveRefresh } from "@/components/agents/live-refresh";
import { AgentBoard } from "@/components/agents/board";
import { TaskComposer } from "@/components/agents/task-composer";
import { buttonClass, EmptyState, Tile, TileTitle } from "@/components/ui";
import { ENGINES, MAX_CONCURRENT_RUNS, type Engine } from "@/lib/agents/catalog";
import { claudeConfigured } from "@/lib/agents/github";
import { getAgents, getBoard } from "@/lib/agents/server";
import { aiConfigured } from "@/lib/ai/llm";
import { createStarterAgents } from "./actions";

export const metadata: Metadata = { title: "Agentes" };
// Los agentes de Gemini trabajan después de responder (after): margen hasta el límite de Vercel (300 s en Hobby)
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const [agents, board] = await Promise.all([getAgents(), getBoard()]);
  const active = agents.filter((a) => a.active);
  const runs = board.flatMap((t) => t.runs);
  const live = runs.some((r) => r.status === "queued" || r.status === "working");
  const waiting = runs.filter((r) => r.pendingActions > 0);

  return (
    <div className="flex flex-col gap-3.5">
      <LiveRefresh active={live} />

      <Tile>
        <TileTitle dot="bg-content">Nueva tarea</TileTitle>
        <p className="text-muted mt-1 text-sm">
          Elige uno o varios agentes: cada uno trabaja por su cuenta (máx. {MAX_CONCURRENT_RUNS} a la vez) y sigues su
          progreso aquí abajo.
        </p>
        <div className="mt-5">
          {active.length ? (
            <TaskComposer
              agents={active.map(({ id, name, role, engine }) => ({ id, name, role, engine }))}
              aiReady={aiConfigured()}
              claudeReady={claudeConfigured()}
            />
          ) : (
            <EmptyState>Crea un agente (o los de partida) para empezar a mandarle tareas.</EmptyState>
          )}
        </div>
      </Tile>

      {waiting.length > 0 && (
        <p role="status" className="bg-surface-2 rounded-inner text-attention px-4 py-3 text-sm">
          Tienes {waiting.reduce((s, r) => s + r.pendingActions, 0)} propuesta(s) esperando tu aprobación:{" "}
          {waiting.map((r, i) => (
            <span key={r.id}>
              {i > 0 && ", "}
              <Link href={`/ia/agentes/ejecucion/${r.id}`} className="underline underline-offset-2">
                {r.agent_name}
              </Link>
            </span>
          ))}
          .
        </p>
      )}

      <Tile>
        <TileTitle dot="bg-content">Tablero</TileTitle>
        <AgentBoard board={board} />
      </Tile>

      <Tile>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TileTitle dot="bg-content">Agentes</TileTitle>
          <Link href="/ia/agentes/nuevo" className={buttonClass.secondary}>
            Nuevo agente
          </Link>
        </div>
        {agents.length ? (
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {agents.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/ia/agentes/${a.id}`}
                  className="border-border hover:bg-surface-2 rounded-inner flex h-full flex-col gap-1 border p-3.5 transition-colors duration-150"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{a.name}</span>
                    <span className="text-muted text-xs">
                      {ENGINES[a.engine as Engine]?.label}
                      {!a.active && " · pausado"}
                    </span>
                  </span>
                  {a.role && <span className="text-muted text-sm">{a.role}</span>}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-4 flex flex-col items-start gap-3">
            <p className="text-muted text-sm">
              Empieza con cinco agentes ya preparados: analista financiero, coach de gym y nutrición, guionista,
              desarrollador e investigador. Luego puedes cambiarlos.
            </p>
            <form action={createStarterAgents}>
              <button type="submit" className={buttonClass.primary}>
                Crear agentes de partida
              </button>
            </form>
          </div>
        )}
      </Tile>
    </div>
  );
}
