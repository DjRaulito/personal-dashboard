"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { clsx } from "clsx";
import { useRouter } from "next/navigation";
import {
  createLocalWorkerKey,
  createWorkerKey,
  deleteVoiceSample,
  saveStudioSettings,
  saveVoiceSample,
  type KeyResult,
} from "@/app/(app)/contenido/estudio/actions";
import { buttonClass, Field, FormMessage, inputClass } from "@/components/ui";
import { AI_VOICES, VIDEO_FORMAT_LABEL, VIDEO_FORMATS, type AiVoice } from "@/lib/studio/catalog";

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
          Con el estudio local encendido, tus vídeos se montan en tu PC con VoiceStudio (tu voz con la GPU). Si está
          apagado, se montan en GitHub Actions como siempre.
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
            Pégala en el archivo <code className="text-content">.env.local</code> del proyecto, en tu PC (solo se muestra
            ahora):
          </p>
          <code className="bg-surface border-border-strong rounded-inner block border px-3 py-2 break-all">
            STUDIO_LOCAL_TOKEN={result.token}
          </code>
          <p className="text-muted text-xs">
            Después, con VoiceStudio abierto, arranca <code>studio\local.ps1</code> y déjalo en marcha.
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Muestra de voz
// ---------------------------------------------------------------------------

const READ_ALOUD =
  "Hola, soy yo. Esta es una muestra de mi voz para mis vídeos. Hablo tranquilo, a mi ritmo de siempre, " +
  "como si se lo contara a un amigo. Hoy toca entrenar, revisar las finanzas del mes y preparar el contenido " +
  "de la semana. Lo importante es la constancia: un poco cada día suma muchísimo al final del año.";

const MAX_SECONDS = 45;

export function VoiceSample({ hasSample }: { hasSample: boolean }) {
  const router = useRouter();
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
      recorder.current?.stream.getTracks().forEach((t) => t.stop());
    },
    [],
  );
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);

  function takeBlob(b: Blob) {
    setBlob(b);
    setUrl(URL.createObjectURL(b));
  }

  async function startRecording() {
    setMessage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
      });
      const type = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg"].find((t) => MediaRecorder.isTypeSupported(t));
      const rec = new MediaRecorder(stream, type ? { mimeType: type, audioBitsPerSecond: 64000 } : undefined);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        takeBlob(new Blob(chunks, { type: rec.mimeType || "audio/webm" }));
        if (timer.current) clearInterval(timer.current);
        setRecording(false);
      };
      recorder.current = rec;
      rec.start();
      setRecording(true);
      setSeconds(0);
      timer.current = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_SECONDS && rec.state === "recording") rec.stop();
          return s + 1;
        });
      }, 1000);
    } catch {
      setMessage({ ok: false, message: "No se pudo usar el micrófono. Revisa el permiso del navegador." });
    }
  }

  function save() {
    if (!blob) return;
    const form = new FormData();
    const ext = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
    form.append("sample", new File([blob], `muestra.${ext}`, { type: blob.type.split(";")[0] }));
    start(async () => {
      const result = await saveVoiceSample(form);
      setMessage(result);
      if (result.ok) {
        setBlob(null);
        setUrl(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm">
        {hasSample ? (
          <span className="text-finance">Tienes una muestra guardada.</span>
        ) : (
          <span className="text-muted">Sin muestra: los vídeos usan la voz IA.</span>
        )}{" "}
        <span className="text-muted">
          Graba 20-45 s en un sitio silencioso leyendo este texto (o lo que quieras). Se guarda en tu base de datos, no
          en el repo.
        </span>
      </p>
      <blockquote className="bg-surface-2 rounded-inner px-4 py-3 text-sm leading-relaxed">{READ_ALOUD}</blockquote>
      <div className="flex flex-wrap items-center gap-2">
        {recording ? (
          <button type="button" onClick={() => recorder.current?.stop()} className={buttonClass.primary}>
            Parar ({MAX_SECONDS - seconds} s)
          </button>
        ) : (
          <button type="button" onClick={startRecording} disabled={pending} className={buttonClass.secondary}>
            {blob ? "Grabar otra vez" : "Grabar"}
          </button>
        )}
        <label className={clsx(buttonClass.secondary, "cursor-pointer")}>
          Subir un audio
          <input
            type="file"
            accept="audio/*"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) takeBlob(file);
            }}
          />
        </label>
        {hasSample && !blob && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (confirm("¿Borrar tu muestra de voz?")) start(() => deleteVoiceSample());
            }}
            className={buttonClass.danger}
          >
            Borrar muestra
          </button>
        )}
      </div>
      {recording && (
        <p role="status" className="text-attention text-sm">
          Grabando… {seconds} s
        </p>
      )}
      {url && (
        <div className="flex flex-wrap items-center gap-3">
          <audio src={url} controls className="max-w-full" />
          <button type="button" onClick={save} disabled={pending} className={buttonClass.primary}>
            {pending ? "Guardando…" : "Guardar muestra"}
          </button>
        </div>
      )}
      {message && <FormMessage state={message} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Voz por defecto y piloto automático
// ---------------------------------------------------------------------------

const DAYS = [
  [1, "L"],
  [2, "M"],
  [3, "X"],
  [4, "J"],
  [5, "V"],
  [6, "S"],
  [0, "D"],
] as const;
const DAY_NAMES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

export interface SettingsValues {
  ai_voice: AiVoice;
  autopilot: boolean;
  autopilot_days: number[];
  autopilot_format: "short" | "long";
  autopilot_voice: "ai" | "clone";
}

export function StudioSettingsForm({ values, hasSample }: { values: SettingsValues; hasSample: boolean }) {
  const [state, action, pending] = useActionState(saveStudioSettings, { ok: false });
  const [on, setOn] = useState(values.autopilot);
  return (
    <form action={action} className="flex flex-col gap-5">
      <Field label="Voz IA por defecto" error={state.errors?.ai_voice}>
        <select name="ai_voice" defaultValue={values.ai_voice} className={inputClass}>
          {(Object.keys(AI_VOICES) as AiVoice[]).map((v) => (
            <option key={v} value={v}>
              {AI_VOICES[v]}
            </option>
          ))}
        </select>
      </Field>

      <label className="flex items-start gap-2.5 text-sm">
        <input
          type="checkbox"
          name="autopilot"
          checked={on}
          onChange={(e) => setOn(e.target.checked)}
          className="accent-content mt-0.5 h-4 w-4"
        />
        <span>
          Piloto automático
          <span className="text-muted block text-xs">
            Los días elegidos, por la mañana, coge la idea de más prioridad del banco (del formato elegido) y hace el
            vídeo entero. Solo tienes que aprobarlo.
          </span>
        </span>
      </label>

      <fieldset disabled={!on} className="flex flex-col gap-4 disabled:opacity-50">
        <div className="flex flex-col gap-2">
          <legend className="text-muted text-sm">Días</legend>
          <div className="flex flex-wrap gap-1.5">
            {DAYS.map(([value, letter]) => (
              <label
                key={value}
                className="bg-surface-2 has-[:checked]:bg-content has-[:checked]:text-ink has-[:focus-visible]:outline-content flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-sm font-medium has-[:focus-visible]:outline-2"
              >
                <input
                  type="checkbox"
                  name="autopilot_days"
                  value={value}
                  defaultChecked={values.autopilot_days.includes(value)}
                  aria-label={DAY_NAMES[value]}
                  className="sr-only"
                />
                {letter}
              </label>
            ))}
          </div>
          {state.errors?.autopilot_days && (
            <span className="text-attention text-xs">{state.errors.autopilot_days}</span>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Formato">
            <select name="autopilot_format" defaultValue={values.autopilot_format} className={inputClass}>
              {VIDEO_FORMATS.map((f) => (
                <option key={f} value={f}>
                  {VIDEO_FORMAT_LABEL[f]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Voz">
            <select name="autopilot_voice" defaultValue={values.autopilot_voice} className={inputClass}>
              <option value="ai">Voz IA</option>
              <option value="clone" disabled={!hasSample}>
                Tu voz{hasSample ? "" : " (graba antes la muestra)"}
              </option>
            </select>
          </Field>
        </div>
      </fieldset>
      {/* Con el piloto apagado, el fieldset desactivado no envía sus campos: se mandan los guardados */}
      {!on && (
        <>
          {values.autopilot_days.map((d) => (
            <input key={d} type="hidden" name="autopilot_days" value={d} />
          ))}
          <input type="hidden" name="autopilot_format" value={values.autopilot_format} />
          <input type="hidden" name="autopilot_voice" value={values.autopilot_voice} />
        </>
      )}

      <FormMessage state={state} />
      <button type="submit" disabled={pending} className={clsx(buttonClass.primary, "self-start")}>
        {pending ? "Guardando…" : "Guardar ajustes"}
      </button>
    </form>
  );
}
