"use client";

import { useActionState, useState } from "react";
import { clsx } from "clsx";
import { saveStudioSettings } from "@/app/(app)/contenido/estudio/actions/settings";
import { buttonClass, Field, FormMessage, inputClass } from "@/components/ui";
import { AI_VOICES, VIDEO_FORMAT_LABEL, VIDEO_FORMATS, type AiVoice } from "@/lib/studio/catalog";

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
