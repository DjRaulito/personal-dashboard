"use client";

import { useActionState, useState, useTransition } from "react";
import { clsx } from "clsx";
import { deleteAgent, saveAgent } from "@/app/(app)/ia/agentes/actions";
import { buttonClass, Field, FormMessage, inputClass } from "@/components/ui";
import { ENGINES, toolsFor, type Engine } from "@/lib/agents/catalog";

export interface AgentFormValues {
  id?: string;
  name: string;
  role: string;
  instructions: string;
  engine: Engine;
  tools: string[];
  max_steps: number;
  active: boolean;
}

export function AgentForm({ agent }: { agent: AgentFormValues }) {
  const [state, action, pending] = useActionState(saveAgent, { ok: false });
  const [engine, setEngine] = useState<Engine>(agent.engine);
  const [deleting, startDelete] = useTransition();

  return (
    <form action={action} className="flex flex-col gap-5">
      {agent.id && <input type="hidden" name="id" value={agent.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre" error={state.errors?.name}>
          <input name="name" defaultValue={agent.name} maxLength={40} required className={inputClass} />
        </Field>
        <Field label="Rol (una línea)" error={state.errors?.role}>
          <input name="role" defaultValue={agent.role} maxLength={120} className={inputClass} />
        </Field>
      </div>

      <Field label="Instrucciones" error={state.errors?.instructions}>
        <textarea
          name="instructions"
          defaultValue={agent.instructions}
          rows={5}
          maxLength={4000}
          className={clsx(inputClass, "resize-y")}
        />
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-muted mb-1.5 text-sm">Motor</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(Object.keys(ENGINES) as Engine[]).map((e) => (
            <label
              key={e}
              className={clsx(
                "rounded-inner flex cursor-pointer flex-col gap-0.5 border p-3.5 text-sm transition-colors duration-150",
                "has-[:focus-visible]:outline-content has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2",
                engine === e ? "border-content bg-surface-2" : "border-border-strong hover:bg-surface-2",
              )}
            >
              <input
                type="radio"
                name="engine"
                value={e}
                checked={engine === e}
                onChange={() => setEngine(e)}
                className="sr-only"
              />
              <span className="font-medium">{ENGINES[e].label}</span>
              <span className="text-muted text-xs">{ENGINES[e].hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-muted mb-1.5 text-sm">Herramientas permitidas</legend>
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {toolsFor(engine).map((t) => (
            <li key={`${engine}-${t.name}`}>
              <label className="flex items-start gap-2.5 py-1 text-sm">
                <input
                  type="checkbox"
                  name="tools"
                  value={t.name}
                  defaultChecked={agent.tools.includes(t.name)}
                  className="accent-content mt-0.5 h-4 w-4"
                />
                <span>
                  {t.label}
                  {t.effect && <span className="text-attention block text-xs">Necesita tu aprobación</span>}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Pasos máximos (1-10)" error={state.errors?.max_steps}>
          <input
            name="max_steps"
            type="number"
            inputMode="numeric"
            min={1}
            max={10}
            defaultValue={agent.max_steps}
            className={inputClass}
          />
        </Field>
        <label className="flex items-center gap-2.5 self-end py-2.5 text-sm">
          <input type="checkbox" name="active" defaultChecked={agent.active} className="accent-content h-4 w-4" />
          Activo (aparece al enviar tareas)
        </label>
      </div>

      <FormMessage state={state} />
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={pending} className={buttonClass.primary}>
          {pending ? "Guardando…" : agent.id ? "Guardar cambios" : "Crear agente"}
        </button>
        {agent.id && (
          <button
            type="button"
            disabled={deleting}
            onClick={() => {
              if (confirm(`¿Borrar el agente «${agent.name}»? Sus resultados se conservan.`))
                startDelete(() => deleteAgent(agent.id!));
            }}
            className={buttonClass.danger}
          >
            {deleting ? "Borrando…" : "Borrar agente"}
          </button>
        )}
      </div>
    </form>
  );
}
