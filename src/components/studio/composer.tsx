"use client";

import { useActionState, useState } from "react";
import { clsx } from "clsx";
import { createVideo } from "@/app/(app)/contenido/estudio/actions";
import { buttonClass, Field, FormMessage, inputClass } from "@/components/ui";
import {
  AI_VOICES,
  DURATION,
  formatDuration,
  VIDEO_FORMAT_LABEL,
  VIDEO_FORMATS,
  type AiVoice,
  type VideoFormat,
  type VoiceMode,
} from "@/lib/studio/catalog";

export interface IdeaOption {
  id: string;
  title: string;
  notes: string | null;
  format: string;
}

const choiceClass = (active: boolean) =>
  clsx(
    "rounded-inner flex cursor-pointer flex-col gap-0.5 border p-3.5 text-sm transition-colors duration-150",
    "has-[:focus-visible]:outline-content has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2",
    "has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50",
    active ? "border-content bg-surface-2" : "border-border-strong hover:bg-surface-2",
  );

export function StudioComposer({
  ideas,
  defaultVoice,
  hasSample,
  initialPieceId,
}: {
  ideas: IdeaOption[];
  defaultVoice: AiVoice;
  hasSample: boolean;
  initialPieceId?: string;
}) {
  const [state, action, pending] = useActionState(createVideo, { ok: false });
  const initial = ideas.find((i) => i.id === initialPieceId);
  const [pieceId, setPieceId] = useState(initial?.id ?? "");
  const [topic, setTopic] = useState(initial ? [initial.title, initial.notes].filter(Boolean).join("\n") : "");
  const [format, setFormat] = useState<VideoFormat>(initial?.format === "long" ? "long" : "short");
  const [seconds, setSeconds] = useState(DURATION[format].default);
  const [mode, setMode] = useState<VoiceMode>("ai");
  const range = DURATION[format];

  function pickIdea(id: string) {
    setPieceId(id);
    const idea = ideas.find((i) => i.id === id);
    if (!idea) return;
    setTopic([idea.title, idea.notes].filter(Boolean).join("\n"));
    const f: VideoFormat = idea.format === "long" ? "long" : "short";
    setFormat(f);
    setSeconds(DURATION[f].default);
  }

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="piece_id" value={pieceId} />
      {ideas.length > 0 && (
        <Field label="Desde una idea del banco (opcional)">
          <select value={pieceId} onChange={(e) => pickIdea(e.target.value)} className={inputClass}>
            <option value="">Tema libre</option>
            {ideas.map((i) => (
              <option key={i.id} value={i.id}>
                {i.title}
              </option>
            ))}
          </select>
        </Field>
      )}

      <Field label="¿De qué va el vídeo?" error={state.errors?.topic}>
        <textarea
          name="topic"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          required
          rows={3}
          maxLength={2000}
          placeholder="Ej.: 3 errores que frenan tu progreso en el gimnasio y cómo evitarlos"
          className={clsx(inputClass, "resize-y")}
        />
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-muted mb-1.5 text-sm">Formato</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {VIDEO_FORMATS.map((f) => (
            <label key={f} className={choiceClass(format === f)}>
              <input
                type="radio"
                name="format"
                value={f}
                checked={format === f}
                onChange={() => {
                  setFormat(f);
                  setSeconds(DURATION[f].default);
                }}
                className="sr-only"
              />
              <span className="font-medium">{VIDEO_FORMAT_LABEL[f]}</span>
              <span className="text-muted text-xs">
                {f === "short" ? "TikTok, Reels y Shorts" : "YouTube"} · {formatDuration(DURATION[f].min)}–
                {formatDuration(DURATION[f].max)}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-muted flex justify-between">
          Duración aproximada <span className="text-text tabular-nums">{formatDuration(seconds)}</span>
        </span>
        <input
          type="range"
          name="target_seconds"
          min={range.min}
          max={range.max}
          step={range.step}
          value={seconds}
          onChange={(e) => setSeconds(Number(e.target.value))}
          className="accent-content"
        />
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-muted mb-1.5 text-sm">Voz</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className={choiceClass(mode === "ai")}>
            <input
              type="radio"
              name="voice_mode"
              value="ai"
              checked={mode === "ai"}
              onChange={() => setMode("ai")}
              className="sr-only"
            />
            <span className="font-medium">Voz IA</span>
            <span className="text-muted text-xs">Rápida. Elige cuál abajo.</span>
          </label>
          <label className={choiceClass(mode === "clone")}>
            <input
              type="radio"
              name="voice_mode"
              value="clone"
              checked={mode === "clone"}
              onChange={() => setMode("clone")}
              disabled={!hasSample}
              className="sr-only"
            />
            <span className="font-medium">Tu voz</span>
            <span className="text-muted text-xs">
              {hasSample ? "Clonada de tu muestra. Tarda más." : "Graba antes tu muestra en Ajustes."}
            </span>
          </label>
        </div>
        {state.errors?.voice_mode && <span className="text-attention text-xs">{state.errors.voice_mode}</span>}
      </fieldset>

      <Field label="Voz IA">
        <select name="voice" defaultValue={defaultVoice} disabled={mode !== "ai"} className={inputClass}>
          {(Object.keys(AI_VOICES) as AiVoice[]).map((v) => (
            <option key={v} value={v}>
              {AI_VOICES[v]}
            </option>
          ))}
        </select>
        {mode !== "ai" && <input type="hidden" name="voice" value={defaultVoice} />}
      </Field>

      <label className="flex items-start gap-2.5 text-sm">
        <input type="checkbox" name="review" className="accent-content mt-0.5 h-4 w-4" />
        <span>
          Quiero revisar el guion antes de montar
          <span className="text-muted block text-xs">
            Si no lo marcas, el vídeo se hace solo de principio a fin y te avisa cuando esté listo.
          </span>
        </span>
      </label>

      <FormMessage state={state} />
      <button type="submit" disabled={pending} className={clsx(buttonClass.primary, "self-start")}>
        {pending ? "Creando…" : "Crear vídeo"}
      </button>
    </form>
  );
}
