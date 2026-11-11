"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { clsx } from "clsx";
import { useRouter } from "next/navigation";
import { deleteVoiceSample, saveVoiceSample } from "@/app/(app)/contenido/estudio/actions/settings";
import { buttonClass, FormMessage } from "@/components/ui";

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
