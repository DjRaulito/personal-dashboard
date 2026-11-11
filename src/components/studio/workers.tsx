"use client";

import { useState, useTransition } from "react";
import { clsx } from "clsx";
import { createLocalWorkerKey, createWorkerKey, type KeyResult } from "@/app/(app)/contenido/estudio/actions/settings";
import { buttonClass, FormMessage } from "@/components/ui";

// Dónde se montan los vídeos: tu PC (estudio local) o GitHub Actions, cada uno con su clave.

// ---------------------------------------------------------------------------
// Clave del estudio
// ---------------------------------------------------------------------------

export function WorkerKey({ configured }: { configured: boolean }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<KeyResult | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">
        {configured ? (
          <span className="text-finance">Clave creada.</span>
        ) : (
          <span className="text-attention">Aún no hay clave.</span>
        )}{" "}
        <span className="text-muted">
          GitHub Actions la usa para leer el guion y avisar del progreso. Se guarda sola como secreto del repo si el
          token de GitHub tiene el permiso «Secrets».
        </span>
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (configured && !confirm("¿Crear una clave nueva? La anterior deja de valer.")) return;
          start(async () => setResult(await createWorkerKey()));
        }}
        className={clsx(buttonClass.secondary, "self-start")}
      >
        {pending ? "Creando…" : configured ? "Crear una clave nueva" : "Crear la clave"}
      </button>
      {result && <FormMessage state={result} />}
      {result?.token && (
        <div className="bg-surface-2 rounded-inner flex flex-col gap-2 p-3.5 text-sm">
          <p>
            GitHub → Settings → Secrets and variables → Actions → <b>New repository secret</b>, con el nombre{" "}
            <code className="text-content">STUDIO_WORKER_TOKEN</code> y este valor (solo se muestra ahora):
          </p>
          <code className="bg-surface border-border-strong rounded-inner block border px-3 py-2 break-all">
            {result.token}
          </code>
          <p className="text-muted text-xs">
            Para el piloto automático, crea también <code>STUDIO_APP_URL</code> con la dirección del dashboard.
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Estudio local (tu PC)
// ---------------------------------------------------------------------------

export function LocalWorker({
  configured,
  online,
  info,
  lastSeen,
}: {
  configured: boolean;
  online: boolean;
  info: string | null;
  lastSeen: string | null;
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<KeyResult | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">
        {!configured ? (
          <span className="text-attention">Sin clave.</span>
        ) : online ? (
          <span className="text-finance">Encendido{info ? ` · ${info}` : ""}.</span>
        ) : (
          <span className="text-muted">Apagado{lastSeen ? ` (última señal: ${lastSeen})` : ""}.</span>
        )}{" "}
        <span className="text-muted">
          Con el estudio local encendido, tus vídeos se montan en tu PC: la voz la pone el programa VoiceStudio con tu
          GPU. Si está apagado, se montan en GitHub Actions como siempre.
        </span>
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (configured && !confirm("¿Crear una clave nueva para tu PC? La anterior deja de valer.")) return;
          start(async () => setResult(await createLocalWorkerKey()));
        }}
        className={clsx(buttonClass.secondary, "self-start")}
      >
        {pending ? "Creando…" : configured ? "Crear una clave nueva" : "Crear la clave del PC"}
      </button>
      {result && <FormMessage state={result} />}
      {result?.token && (
        <div className="bg-surface-2 rounded-inner flex flex-col gap-2 p-3.5 text-sm">
          <p>
            Pégala en el archivo <code className="text-content">.env.local</code> del proyecto, en tu PC (solo se
            muestra ahora):
          </p>
          <code className="bg-surface border-border-strong rounded-inner block border px-3 py-2 break-all">
            STUDIO_LOCAL_TOKEN={result.token}
          </code>
          <p className="text-muted text-xs">
            Después, con el programa VoiceStudio abierto, arranca <code>studio\local.ps1</code> y déjalo en marcha.
          </p>
        </div>
      )}
    </div>
  );
}
