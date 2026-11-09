"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  deleteCheat,
  deleteFood,
  deleteReview,
  estimateCheat,
  estimateFood,
  saveCheat,
  saveFood,
  saveReview,
} from "@/app/(app)/nutricion/actions";
import { buttonClass, Field, FormMessage, inputClass } from "@/components/ui";
import type { FormState } from "@/lib/finance/schemas";

const fmt = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v).replace(".", ","));

function useResetOnSuccess(state: FormState, editing: boolean, onDone?: () => void) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!state.ok) return;
    if (!editing) ref.current?.reset();
    onDone?.();
  }, [state, editing, onDone]);
  return ref;
}

// ---------------------------------------------------------------------------
// Alimentos
// ---------------------------------------------------------------------------

export interface FoodValues {
  id: string;
  name: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  unit_label: string | null;
  unit_grams: number | null;
  cooked_from?: string | null;
  cooked_factor?: number | null;
}

export function FoodForm({
  food,
  rawFoods,
  onDone,
}: {
  food?: FoodValues;
  rawFoods: { id: string; name: string }[];
  onDone?: () => void;
}) {
  const [state, action, pending] = useActionState(saveFood, { ok: false });
  const ref = useResetOnSuccess(state, !!food, onDone);
  const [values, setValues] = useState({
    name: food?.name ?? "",
    kcal: fmt(food?.kcal),
    protein_g: fmt(food?.protein_g),
    carbs_g: fmt(food?.carbs_g),
    fat_g: fmt(food?.fat_g),
    unit_label: food?.unit_label ?? "",
    unit_grams: fmt(food?.unit_grams),
  });
  const [source, setSource] = useState<"manual" | "ai">("manual");
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [aiPending, startAi] = useTransition();
  const set = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));

  useEffect(() => {
    if (state.ok && !food) {
      setValues({ name: "", kcal: "", protein_g: "", carbs_g: "", fat_g: "", unit_label: "", unit_grams: "" });
      setSource("manual");
    }
  }, [state, food]);

  return (
    <form ref={ref} action={action} autoComplete="off" className="flex flex-col gap-4">
      {food && <input type="hidden" name="id" value={food.id} />}
      <input type="hidden" name="source" value={source} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <Field label="Nombre" error={state.errors?.name} className="sm:col-span-2">
          <input
            name="name"
            required
            maxLength={80}
            value={values.name}
            onChange={set("name")}
            className={inputClass}
          />
        </Field>
        <Field label="Kcal / 100 g" error={state.errors?.kcal}>
          <input
            name="kcal"
            required
            inputMode="decimal"
            value={values.kcal}
            onChange={set("kcal")}
            className={`${inputClass} tabular-nums`}
          />
        </Field>
        <Field label="Proteína (g)" error={state.errors?.protein_g}>
          <input
            name="protein_g"
            required
            inputMode="decimal"
            value={values.protein_g}
            onChange={set("protein_g")}
            className={`${inputClass} tabular-nums`}
          />
        </Field>
        <Field label="Hidratos (g)" error={state.errors?.carbs_g}>
          <input
            name="carbs_g"
            required
            inputMode="decimal"
            value={values.carbs_g}
            onChange={set("carbs_g")}
            className={`${inputClass} tabular-nums`}
          />
        </Field>
        <Field label="Grasa (g)" error={state.errors?.fat_g}>
          <input
            name="fat_g"
            required
            inputMode="decimal"
            value={values.fat_g}
            onChange={set("fat_g")}
            className={`${inputClass} tabular-nums`}
          />
        </Field>
        <Field label="Se cuenta por (opcional)" error={state.errors?.unit_label}>
          <input
            name="unit_label"
            maxLength={30}
            placeholder="huevo, lata…"
            value={values.unit_label}
            onChange={set("unit_label")}
            className={inputClass}
          />
        </Field>
        <Field label="Peso de 1 unidad (g)" error={state.errors?.unit_grams}>
          <input
            name="unit_grams"
            inputMode="decimal"
            placeholder="60…"
            value={values.unit_grams}
            onChange={set("unit_grams")}
            className={`${inputClass} tabular-nums`}
          />
        </Field>
        <Field label="Es la versión cocida de" error={state.errors?.cooked_from} className="sm:col-span-2">
          <select name="cooked_from" defaultValue={food?.cooked_from ?? ""} className={inputClass}>
            <option value="">— (se pesa tal cual)</option>
            {rawFoods
              .filter((f) => f.id !== food?.id)
              .map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Factor (cocido = crudo ×)" error={state.errors?.cooked_factor}>
          <input
            name="cooked_factor"
            inputMode="decimal"
            placeholder="2,5…"
            defaultValue={fmt(food?.cooked_factor)}
            className={`${inputClass} tabular-nums`}
          />
        </Field>
      </div>
      <FormMessage state={state} />
      {aiMessage && (
        <p role="status" className="text-muted text-sm">
          {aiMessage}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className={buttonClass.primary}>
          {pending ? "Guardando…" : food ? "Guardar cambios" : "Añadir alimento"}
        </button>
        <button
          type="button"
          disabled={aiPending || values.name.trim().length < 2}
          className={buttonClass.secondary}
          onClick={() =>
            startAi(async () => {
              setAiMessage(null);
              const res = await estimateFood(values.name);
              if (!res.ok) return setAiMessage(res.message);
              const d = res.data;
              setValues((v) => ({
                ...v,
                kcal: fmt(Math.round(d.kcal)),
                protein_g: fmt(Math.round(d.protein_g * 10) / 10),
                carbs_g: fmt(Math.round(d.carbs_g * 10) / 10),
                fat_g: fmt(Math.round(d.fat_g * 10) / 10),
                unit_label: d.unit_label ?? v.unit_label,
                unit_grams: d.unit_grams ? fmt(d.unit_grams) : v.unit_grams,
              }));
              setSource("ai");
              setAiMessage("Valores estimados por la IA: revísalos con la etiqueta si la tienes.");
            })
          }
        >
          {aiPending ? "Consultando…" : "Rellenar macros con IA"}
        </button>
      </div>
    </form>
  );
}

export function FoodActions({ food, rawFoods }: { food: FoodValues; rawFoods: { id: string; name: string }[] }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <>
      <div className="flex gap-1">
        <button type="button" className={buttonClass.secondary} onClick={() => setEditing((v) => !v)}>
          {editing ? "Cerrar" : "Editar"}
        </button>
        <button
          type="button"
          disabled={pending}
          className={buttonClass.danger}
          onClick={() => {
            if (confirm(`¿Borrar "${food.name}"? Se quitará también del plan y de lo apuntado.`)) {
              startTransition(() => deleteFood(food.id));
            }
          }}
        >
          Borrar
        </button>
      </div>
      {editing && (
        <div className="bg-surface-2 rounded-inner mt-3 basis-full p-4">
          <FoodForm food={food} rawFoods={rawFoods} onDone={() => setEditing(false)} />
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Cheat meals
// ---------------------------------------------------------------------------

export function CheatForm({ today }: { today: string }) {
  const [state, action, pending] = useActionState(saveCheat, { ok: false });
  const ref = useResetOnSuccess(state, false);
  const [description, setDescription] = useState("");
  const [macros, setMacros] = useState({ kcal: "", protein_g: "", carbs_g: "", fat_g: "" });
  const [ai, setAi] = useState<{ by: "manual" | "ai"; notes: string }>({ by: "manual", notes: "" });
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [aiPending, startAi] = useTransition();

  useEffect(() => {
    if (state.ok) {
      setDescription("");
      setMacros({ kcal: "", protein_g: "", carbs_g: "", fat_g: "" });
      setAi({ by: "manual", notes: "" });
      setAiMessage(null);
    }
  }, [state]);

  const setMacro = (k: keyof typeof macros) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setMacros((m) => ({ ...m, [k]: e.target.value }));

  return (
    <form ref={ref} action={action} autoComplete="off" className="flex flex-col gap-4">
      <input type="hidden" name="estimated_by" value={ai.by} />
      <input type="hidden" name="ai_notes" value={ai.notes} />
      <div className="grid gap-4 sm:grid-cols-4">
        <Field label="Fecha" error={state.errors?.eaten_on}>
          <input type="date" name="eaten_on" required defaultValue={today} max={today} className={inputClass} />
        </Field>
        <Field label="¿Qué comiste?" error={state.errors?.description} className="sm:col-span-3">
          <textarea
            name="description"
            required
            maxLength={1000}
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Hamburguesa doble con patatas y una Coca-Cola, 2 porciones de pizza…"
            className={inputClass}
          />
        </Field>
        <Field label="Kcal" error={state.errors?.kcal}>
          <input
            name="kcal"
            inputMode="numeric"
            value={macros.kcal}
            onChange={setMacro("kcal")}
            className={`${inputClass} tabular-nums`}
          />
        </Field>
        <Field label="Proteína (g)" error={state.errors?.protein_g}>
          <input
            name="protein_g"
            inputMode="numeric"
            value={macros.protein_g}
            onChange={setMacro("protein_g")}
            className={`${inputClass} tabular-nums`}
          />
        </Field>
        <Field label="Hidratos (g)" error={state.errors?.carbs_g}>
          <input
            name="carbs_g"
            inputMode="numeric"
            value={macros.carbs_g}
            onChange={setMacro("carbs_g")}
            className={`${inputClass} tabular-nums`}
          />
        </Field>
        <Field label="Grasa (g)" error={state.errors?.fat_g}>
          <input
            name="fat_g"
            inputMode="numeric"
            value={macros.fat_g}
            onChange={setMacro("fat_g")}
            className={`${inputClass} tabular-nums`}
          />
        </Field>
      </div>
      {(aiMessage || ai.notes) && (
        <p role="status" className="text-muted text-sm">
          {aiMessage ?? `IA: ${ai.notes}`}
        </p>
      )}
      <FormMessage state={state} />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={aiPending || description.trim().length < 3}
          className={buttonClass.secondary}
          onClick={() =>
            startAi(async () => {
              setAiMessage(null);
              const res = await estimateCheat(description);
              if (!res.ok) return setAiMessage(res.message);
              const d = res.data;
              setMacros({
                kcal: String(Math.round(d.kcal)),
                protein_g: String(Math.round(d.protein_g)),
                carbs_g: String(Math.round(d.carbs_g)),
                fat_g: String(Math.round(d.fat_g)),
              });
              setAi({ by: "ai", notes: d.notes });
            })
          }
        >
          {aiPending ? "Estimando…" : "Estimar kcal con IA"}
        </button>
        <button type="submit" disabled={pending} className={buttonClass.primary}>
          {pending ? "Guardando…" : "Guardar cheat meal"}
        </button>
      </div>
    </form>
  );
}

export function DeleteButton({ kind, id, label }: { kind: "cheat" | "review"; id: string; label: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      aria-label={`Borrar ${label}`}
      className={buttonClass.danger}
      onClick={() => {
        if (!confirm(`¿Borrar ${label}?`)) return;
        startTransition(() => (kind === "cheat" ? deleteCheat(id) : deleteReview(id)));
      }}
    >
      Borrar
    </button>
  );
}

// ---------------------------------------------------------------------------
// Revisiones
// ---------------------------------------------------------------------------

const MEASURES = [
  ["weight_kg", "Peso (kg)"],
  ["chest_cm", "Pecho"],
  ["shoulder_cm", "Hombro"],
  ["arm_cm", "Brazo"],
  ["abdomen_cm", "Abdomen (ombligo)"],
  ["waist_cm", "Cintura"],
  ["hip_cm", "Cadera"],
  ["thigh_cm", "Muslo"],
  ["calf_cm", "Gemelo"],
] as const;

export function ReviewForm({ today, lastPhase }: { today: string; lastPhase: string | null }) {
  const [state, action, pending] = useActionState(saveReview, { ok: false });
  const ref = useResetOnSuccess(state, false);
  return (
    <form ref={ref} action={action} autoComplete="off" className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
        <Field label="Fecha" error={state.errors?.review_on}>
          <input type="date" name="review_on" required defaultValue={today} max={today} className={inputClass} />
        </Field>
        <Field label="Fase" error={state.errors?.phase}>
          <input
            name="phase"
            maxLength={60}
            defaultValue={lastPhase ?? ""}
            placeholder="Volumen…"
            className={inputClass}
          />
        </Field>
        <Field label="¿Qué tal? (1-5)" error={state.errors?.adherence}>
          <select name="adherence" defaultValue="" className={inputClass}>
            <option value="">—</option>
            <option value="5">5 · Perfecta</option>
            <option value="4">4 · Bien</option>
            <option value="3">3 · Regular</option>
            <option value="2">2 · Floja</option>
            <option value="1">1 · Mal</option>
          </select>
        </Field>
        {MEASURES.map(([name, label]) => (
          <Field key={name} label={label} error={state.errors?.[name]}>
            <input name={name} inputMode="decimal" className={`${inputClass} tabular-nums`} />
          </Field>
        ))}
        <Field
          label="Cómo ha ido / qué dice la nutricionista"
          error={state.errors?.notes}
          className="col-span-2 sm:col-span-4 lg:col-span-6"
        >
          <textarea name="notes" rows={3} maxLength={4000} className={inputClass} />
        </Field>
      </div>
      <FormMessage state={state} />
      <div>
        <button type="submit" disabled={pending} className={buttonClass.primary}>
          {pending ? "Guardando…" : "Guardar revisión"}
        </button>
      </div>
    </form>
  );
}
