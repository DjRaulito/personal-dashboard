"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import { sendTask } from "@/app/(app)/ia/agentes/actions";
import { buttonClass, FormMessage, inputClass } from "@/components/ui";
import { ENGINES, type Engine } from "@/lib/agents/catalog";

interface AgentOption {
  id: string;
  name: string;
  role: string;
  engine: string;
}

export function TaskComposer({
  agents,
  aiReady,
  claudeReady,
}: {
  agents: AgentOption[];
  aiReady: boolean;
  claudeReady: boolean;
}) {
  const [state, action, pending] = useActionState(sendTask, { ok: false });
  const [selected, setSelected] = useState<string[]>([]);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setSelected([]);
    }
  }, [state]);

  const chosen = agents.filter((a) => selected.includes(a.id));
  const usesClaude = chosen.some((a) => a.engine === "claude");
  const blocked =
    (chosen.some((a) => a.engine === "gemini") && !aiReady) || (usesClaude && !claudeReady) || chosen.length === 0;

  const toggle = (agentId: string) =>
    setSelected((prev) => (prev.includes(agentId) ? prev.filter((x) => x !== agentId) : [...prev, agentId]));

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-muted">Tarea</span>
        <textarea
          name="prompt"
          rows={3}
          maxLength={4000}
          required
          placeholder="Ej.: revisa mis gastos de octubre y propón un presupuesto para restaurantes"
          className={clsx(inputClass, "min-h-24 resize-y")}
        />
        {state.errors?.prompt && <span className="text-attention text-xs">{state.errors.prompt}</span>}
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-muted mb-1.5 text-sm">Agentes</legend>
        <ul className="flex flex-wrap gap-2">
          {agents.map((a) => {
            const on = selected.includes(a.id);
            return (
              <li key={a.id}>
                <label
                  className={clsx(
                    "flex cursor-pointer items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition-[background-color,border-color,transform] duration-150 active:scale-[0.97] motion-reduce:active:scale-100",
                    "has-[:focus-visible]:outline-content has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2",
                    on ? "bg-content text-ink border-transparent" : "border-border-strong hover:bg-surface-2",
                  )}
                >
                  <input
                    type="checkbox"
                    name="agents"
                    value={a.id}
                    checked={on}
                    onChange={() => toggle(a.id)}
                    className="sr-only"
                  />
                  <span className="font-medium">{a.name}</span>
                  <span className={clsx("text-xs", on ? "opacity-70" : "text-muted")}>
                    {ENGINES[a.engine as Engine]?.label}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        {state.errors?.agents && <span className="text-attention text-xs">{state.errors.agents}</span>}
      </fieldset>

      {usesClaude && (
        <p className="bg-surface-2 rounded-inner text-muted px-3.5 py-2.5 text-sm">
          {claudeReady
            ? "Claude Code trabaja en GitHub Actions y el repo es público: la tarea y su registro se pueden ver. No pongas datos personales."
            : "Para usar Claude Code falta añadir GITHUB_AGENT_TOKEN en Vercel y CLAUDE_CODE_OAUTH_TOKEN en los secretos de GitHub."}
        </p>
      )}
      {!aiReady && chosen.some((a) => a.engine === "gemini") && (
        <p className="bg-surface-2 rounded-inner text-attention px-3.5 py-2.5 text-sm">
          Falta configurar la IA: añade GEMINI_API_KEY en Vercel.
        </p>
      )}

      <FormMessage state={state} />
      <div>
        <button type="submit" disabled={pending || blocked} className={buttonClass.primary}>
          {pending
            ? "Enviando…"
            : chosen.length > 1
              ? `Enviar a ${chosen.length} agentes`
              : chosen.length === 1
                ? `Enviar a ${chosen[0].name}`
                : "Enviar"}
        </button>
      </div>
    </form>
  );
}
