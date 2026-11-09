"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { deleteMeasurement, saveMeasurement, setExerciseMuscle } from "@/app/(app)/gimnasio/actions";
import { buttonClass, Field, FormMessage, inputClass } from "@/components/ui";
import { MUSCLE_GROUPS, MUSCLE_LABELS, type MuscleGroup } from "@/lib/gym/muscles";

export function MuscleSelect({ exerciseId, value, name }: { exerciseId: string; value: MuscleGroup; name: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <select
      aria-label={`Grupo muscular de ${name}`}
      defaultValue={value}
      disabled={pending}
      onChange={(e) => {
        const group = e.target.value;
        startTransition(() => setExerciseMuscle(exerciseId, group));
      }}
      className={`${inputClass} w-auto py-1.5 text-xs`}
    >
      {MUSCLE_GROUPS.map((g) => (
        <option key={g} value={g}>
          {MUSCLE_LABELS[g]}
        </option>
      ))}
    </select>
  );
}

const FIELDS = [
  { name: "weight_kg", label: "Peso (kg)", placeholder: "75,4" },
  { name: "body_fat_pct", label: "Grasa (%)", placeholder: "15" },
  { name: "waist_cm", label: "Cintura (cm)", placeholder: "82" },
  { name: "chest_cm", label: "Pecho (cm)", placeholder: "100" },
  { name: "arm_cm", label: "Brazo (cm)", placeholder: "36" },
  { name: "thigh_cm", label: "Muslo (cm)", placeholder: "58" },
] as const;

export function MeasurementForm({ today }: { today: string }) {
  const [state, action, pending] = useActionState(saveMeasurement, { ok: false });
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} autoComplete="off" className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Field label="Fecha" error={state.errors?.measured_on}>
          <input type="date" name="measured_on" required defaultValue={today} className={inputClass} />
        </Field>
        {FIELDS.map((f) => (
          <Field key={f.name} label={f.label} error={state.errors?.[f.name]}>
            <input
              name={f.name}
              inputMode="decimal"
              placeholder={`${f.placeholder}…`}
              className={`${inputClass} tabular-nums`}
            />
          </Field>
        ))}
        <Field label="Notas" className="col-span-2 sm:col-span-1">
          <input name="notes" maxLength={500} className={inputClass} />
        </Field>
      </div>
      <FormMessage state={state} />
      <div>
        <button type="submit" disabled={pending} className={buttonClass.primary}>
          {pending ? "Guardando…" : "Guardar medida"}
        </button>
      </div>
    </form>
  );
}

export function DeleteMeasurement({ id, label }: { id: string; label: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      aria-label={`Borrar la medida del ${label}`}
      className={buttonClass.danger}
      onClick={() => {
        if (confirm(`¿Borrar la medida del ${label}?`)) startTransition(() => deleteMeasurement(id));
      }}
    >
      Borrar
    </button>
  );
}
