"use client";

import { useState, useTransition } from "react";
import { cancelAgentRun, decideAgentAction, deleteAgentTask } from "@/app/(app)/ia/agentes/actions";
import { buttonClass } from "@/components/ui";

export function CancelRunButton({ runId }: { runId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => cancelAgentRun(runId))}
      className={buttonClass.danger}
    >
      {pending ? "Cancelando…" : "Cancelar"}
    </button>
  );
}

export function DeleteTaskButton({ taskId }: { taskId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (confirm("¿Borrar esta tarea y sus resultados?")) start(() => deleteAgentTask(taskId));
      }}
      className="text-muted hover:text-text rounded-full px-2 py-1 text-xs transition-colors duration-150"
      aria-label="Borrar tarea"
    >
      {pending ? "Borrando…" : "Borrar"}
    </button>
  );
}

export function ActionDecision({ actionId }: { actionId: string }) {
  const [pending, start] = useTransition();
  const [outcome, setOutcome] = useState<string | null>(null);
  const decide = (approve: boolean) =>
    start(async () => {
      setOutcome(await decideAgentAction(actionId, approve));
    });
  if (outcome) return <p className="text-muted text-sm">{outcome}</p>;
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={pending} onClick={() => decide(true)} className={buttonClass.primary}>
        {pending ? "Aplicando…" : "Aprobar"}
      </button>
      <button type="button" disabled={pending} onClick={() => decide(false)} className={buttonClass.secondary}>
        Rechazar
      </button>
    </div>
  );
}
