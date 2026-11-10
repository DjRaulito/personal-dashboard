import Link from "next/link";
import { EmptyState } from "@/components/ui";
import { ENGINES, isFinished, type Engine } from "@/lib/agents/catalog";
import type { BoardTask } from "@/lib/agents/server";
import { DeleteTaskButton } from "./run-controls";
import { shortDateTime, StatusBadge } from "./status";

/** Tareas recientes con la tarjeta de cada agente que trabaja en ellas. */
export function AgentBoard({ board }: { board: BoardTask[] }) {
  return (
    <>
      {board.length ? (
        <ol className="mt-4 flex flex-col gap-5">
          {board.map((task) => (
            <li key={task.id} className="border-border flex flex-col gap-2.5 border-t pt-4 first:border-t-0 first:pt-0">
              <div className="flex items-start gap-3">
                <p className="line-clamp-3 min-w-0 flex-1 text-sm font-medium whitespace-pre-wrap">{task.prompt}</p>
                <span className="text-muted shrink-0 text-xs tabular-nums">{shortDateTime(task.created_at)}</span>
              </div>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {task.runs.map((run) => (
                  <li key={run.id}>
                    <Link
                      href={`/ia/agentes/ejecucion/${run.id}`}
                      className="bg-surface-2 rounded-inner hover:bg-border flex h-full flex-col gap-1.5 p-3.5 transition-colors duration-150 active:scale-[0.99] motion-reduce:active:scale-100"
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold">{run.agent_name}</span>
                        <StatusBadge status={run.status} />
                      </span>
                      <span className="text-muted line-clamp-2 text-xs">
                        {run.status === "failed" && run.error
                          ? run.error
                          : run.status === "done" && run.result
                            ? run.result
                            : (run.lastLog ?? ENGINES[run.engine as Engine]?.label)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              {task.runs.every((r) => isFinished(r.status) || r.status === "waiting_approval") && (
                <div className="-mt-1 flex justify-end">
                  <DeleteTaskButton taskId={task.id} />
                </div>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState>Aún no has mandado ninguna tarea.</EmptyState>
      )}
    </>
  );
}
