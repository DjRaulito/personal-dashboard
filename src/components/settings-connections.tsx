"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import {
  addInvite,
  deleteAiKey,
  disconnectGoogle,
  removeInvite,
  saveAiKey,
} from "@/app/(app)/ajustes/connections-actions";
import { connectGoogle } from "@/app/login/actions";
import { buttonClass, FormMessage, inputClass } from "@/components/ui";
import { AI_PROVIDERS, PROVIDER_INFO, type ProviderId } from "@/lib/ai/providers";

const linkClass = "text-muted hover:text-text px-2 text-sm underline-offset-2 hover:underline";

/** Botones de Google: conectar / reconectar y desconectar. */
export function GoogleButtons({ connected }: { connected: boolean }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <form action={connectGoogle}>
        <button type="submit" className={connected ? buttonClass.secondary : buttonClass.primary}>
          {connected ? "Reconectar" : "Conectar Google"}
        </button>
      </form>
      {connected && (
        <button
          type="button"
          disabled={pending}
          className={linkClass}
          onClick={() => {
            if (confirm("¿Desconectar Google? El calendario, las hojas y los extractos dejarán de leerse."))
              start(() => disconnectGoogle());
          }}
        >
          Desconectar
        </button>
      )}
    </div>
  );
}

/** Una fila por proveedor de IA: clave guardada (sus 4 últimos caracteres) o formulario para pegarla. */
export function AiKeysManager({ saved }: { saved: Partial<Record<ProviderId, string>> }) {
  return (
    <ul className="flex flex-col gap-2">
      {AI_PROVIDERS.map((id) => (
        <AiKeyRow key={id} id={id} hint={saved[id]} />
      ))}
    </ul>
  );
}

function AiKeyRow({ id, hint }: { id: ProviderId; hint?: string }) {
  const [state, action, saving] = useActionState(saveAiKey, { ok: false });
  const [removing, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);
  const info = PROVIDER_INFO[id];

  return (
    <li className="bg-surface-2 rounded-inner flex flex-col gap-2 px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="font-semibold">{info.label}</span>
        {hint ? (
          <span className="text-muted tabular-nums">✓ Guardada ····{hint}</span>
        ) : (
          <a href={info.url} target="_blank" rel="noreferrer" className={`${linkClass} pl-0`}>
            Conseguir clave gratis ↗
          </a>
        )}
        {hint && (
          <button
            type="button"
            disabled={removing}
            className={`${linkClass} ml-auto`}
            onClick={() => start(() => deleteAiKey(id))}
          >
            Quitar
          </button>
        )}
      </div>
      <form ref={formRef} action={action} autoComplete="off" className="flex flex-wrap gap-2">
        <input type="hidden" name="provider" value={id} />
        <input
          name="key"
          type="password"
          required
          autoComplete="off"
          spellCheck={false}
          aria-label={`Clave de ${info.label}`}
          placeholder={hint ? "Pegar otra clave para sustituirla" : "Pega aquí tu clave"}
          className={`${inputClass} min-w-48 flex-1 py-2`}
        />
        <button type="submit" disabled={saving} className={buttonClass.secondary}>
          {saving ? "Guardando…" : "Guardar"}
        </button>
      </form>
      <FormMessage state={state} />
    </li>
  );
}

export interface InviteRow {
  email: string;
  invited_at: string;
  joined: boolean;
  is_admin: boolean;
}

const dateFmt = new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeZone: "Europe/Madrid" });

/** Invitaciones: quién puede entrar con su cuenta de Google. */
export function InviteManager({ invites }: { invites: InviteRow[] }) {
  const [state, action, pending] = useActionState(addInvite, { ok: false });
  const [removing, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <div className="flex flex-col gap-4">
      <form ref={formRef} action={action} autoComplete="off" className="flex flex-wrap gap-2">
        <input
          name="email"
          type="email"
          required
          aria-label="Email de Google de la persona"
          placeholder="email@gmail.com"
          className={`${inputClass} min-w-56 flex-1`}
        />
        <button type="submit" disabled={pending} className={buttonClass.primary}>
          {pending ? "Invitando…" : "Invitar"}
        </button>
      </form>
      <FormMessage state={state} />
      <ul className="flex flex-col">
        {invites.map((i) => (
          <li
            key={i.email}
            className="border-border flex flex-wrap items-center gap-x-3 gap-y-1 border-t py-2.5 text-sm first:border-t-0"
          >
            <span className="min-w-0 flex-1 truncate font-medium">{i.email}</span>
            <span className="text-muted text-xs">
              {i.is_admin ? "Administrador" : i.joined ? "Ya ha entrado" : "Pendiente"} ·{" "}
              {dateFmt.format(new Date(i.invited_at))}
            </span>
            {!i.is_admin && (
              <button
                type="button"
                disabled={removing}
                className={linkClass}
                onClick={() => {
                  const msg = i.joined
                    ? `¿Quitar la invitación de ${i.email}? Su cuenta y sus datos siguen; solo no podrá crear otra.`
                    : `¿Quitar la invitación de ${i.email}?`;
                  if (confirm(msg)) start(() => removeInvite(i.email));
                }}
              >
                Quitar
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
