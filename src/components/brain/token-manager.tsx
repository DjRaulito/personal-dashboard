"use client";

import { useActionState, useState, useTransition } from "react";
import { createToken, forgetAll, revokeToken } from "@/app/(app)/ia/cerebro/actions";
import { buttonClass, Field, FormMessage, inputClass } from "@/components/ui";

export interface TokenInfo {
  id: string;
  label: string;
  created_at: string;
  last_used_at: string | null;
}

const fmt = new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Madrid" });

function Code({ children }: { children: string }) {
  return (
    <pre className="bg-surface-2 rounded-inner overflow-x-auto p-3 text-xs leading-relaxed break-all whitespace-pre-wrap">
      <code>{children}</code>
    </pre>
  );
}

export function TokenManager({ endpoint, tokens }: { endpoint: string; tokens: TokenInfo[] }) {
  const [state, action, pending] = useActionState(createToken, { ok: false });
  const [revoking, startRevoke] = useTransition();
  const [copied, setCopied] = useState(false);
  const shown = state.token ?? "TU_TOKEN";

  return (
    <div className="flex flex-col gap-5">
      <form action={action} className="flex flex-wrap items-end gap-3">
        <Field label="Nombre del token (para qué IA es)" className="min-w-56 flex-1">
          <input name="label" maxLength={60} placeholder="Claude, ChatGPT, Hermes…" className={inputClass} />
        </Field>
        <button type="submit" disabled={pending} className={buttonClass.primary}>
          {pending ? "Creando…" : "Crear token"}
        </button>
      </form>
      <FormMessage state={state} />

      {state.token && (
        <div role="status" className="border-attention rounded-inner flex flex-col gap-2 border p-4">
          <p className="text-attention text-sm font-medium">Copia el token ahora: no se vuelve a mostrar.</p>
          <Code>{state.token}</Code>
          <button
            type="button"
            className={`${buttonClass.secondary} self-start`}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(state.token!);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? "Copiado" : "Copiar token"}
          </button>
        </div>
      )}

      {tokens.length > 0 && (
        <ul className="divide-border flex flex-col divide-y">
          {tokens.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{t.label || "Sin nombre"}</p>
                <p className="text-muted text-xs">
                  Creado {fmt.format(new Date(t.created_at))} ·{" "}
                  {t.last_used_at ? `usado ${fmt.format(new Date(t.last_used_at))}` : "sin usar"}
                </p>
              </div>
              <button
                type="button"
                disabled={revoking}
                onClick={() => {
                  if (confirm("¿Revocar este token? La IA que lo use perderá el acceso."))
                    startRevoke(() => revokeToken(t.id));
                }}
                className={buttonClass.danger}
              >
                Revocar
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2">
        <h3 className="text-muted text-sm">Cómo conectarlo</h3>
        <p className="text-sm">
          Dirección del servidor MCP:{" "}
          <code className="bg-surface-2 rounded px-1.5 py-0.5 text-xs break-all">{endpoint}</code>
        </p>
        <p className="text-muted text-xs">Claude Code:</p>
        <Code>{`claude mcp add --transport http cerebro ${endpoint} --header "Authorization: Bearer ${shown}"`}</Code>
        <p className="text-muted text-xs">
          Otros clientes (Cursor, Hermes…): añade un servidor MCP «http» con esa dirección y la cabecera
        </p>
        <Code>{`Authorization: Bearer ${shown}`}</Code>
        <p className="text-muted text-xs">
          Herramientas disponibles: remember, search, list, get, link, forget y forget_all. Quien tenga el token puede
          leer y borrar tu memoria: trátalo como una contraseña.
        </p>
      </div>
    </div>
  );
}

export function ForgetAllButton({ disabled }: { disabled: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={disabled || pending}
      onClick={() => {
        if (confirm("¿Borrar TODA la memoria? No se puede deshacer.")) start(() => forgetAll());
      }}
      className={buttonClass.danger}
    >
      {pending ? "Borrando…" : "Olvidar todo"}
    </button>
  );
}
