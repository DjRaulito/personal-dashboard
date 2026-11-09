"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  addSuggestedRecurring,
  contributeToGoal,
  deleteBudget,
  deleteGoal,
  deleteRecurring,
  markRecurringPaid,
  saveBudget,
  saveGoal,
  saveRecurring,
  setGoalArchived,
  setRecurringActive,
} from "@/app/(app)/finanzas/plan/actions";
import { buttonClass, Field, FormMessage, inputClass } from "@/components/ui";
import type { categoryOptions } from "@/lib/finance/categories";
import { parseAmountToCents } from "@/lib/finance/money";
import { FREQUENCIES, FREQUENCY_LABELS, type Frequency, type RecurringSuggestion } from "@/lib/finance/planning";
import { CategoryOptions } from "./category-select";

const euros = (cents: number) => (Math.abs(cents) / 100).toFixed(2).replace(".", ",");

type Option = { id: string; name: string };

/** Formulario con estado de acción que se resetea (o se cierra) al guardar bien. */
function useSavedForm(
  action: Parameters<
    typeof useActionState<{ ok: boolean; message?: string; errors?: Record<string, string> }, FormData>
  >[0],
  editing: boolean,
  onDone?: () => void,
) {
  const [state, formAction, pending] = useActionState(action, { ok: false });
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!state.ok) return;
    if (!editing) ref.current?.reset();
    onDone?.();
  }, [state, editing, onDone]);
  return { state, formAction, pending, ref };
}

// ---------------------------------------------------------------------------
// Presupuestos
// ---------------------------------------------------------------------------

export function BudgetForm({
  categories,
  budget,
  onDone,
}: {
  categories: { id: string; label: string }[];
  budget?: { category_id: string; amount_cents: number };
  onDone?: () => void;
}) {
  const { state, formAction, pending, ref } = useSavedForm(saveBudget, !!budget, onDone);
  return (
    <form ref={ref} action={formAction} className="flex flex-wrap items-end gap-3">
      {budget ? (
        <input type="hidden" name="category_id" value={budget.category_id} />
      ) : (
        <Field label="Categoría" error={state.errors?.category_id} className="min-w-48 flex-1">
          <select name="category_id" required defaultValue="" className={inputClass}>
            <option value="" disabled>
              Elegir…
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label="Límite al mes" error={state.errors?.amount} className="w-36">
        <input
          name="amount"
          required
          inputMode="decimal"
          placeholder="0,00"
          defaultValue={budget ? euros(budget.amount_cents) : undefined}
          className={`${inputClass} tabular-nums`}
        />
      </Field>
      <button type="submit" disabled={pending} className={buttonClass.primary}>
        {pending ? "Guardando…" : budget ? "Guardar" : "Añadir"}
      </button>
      <div className="basis-full empty:hidden">
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function BudgetActions({
  budget,
  label,
}: {
  budget: { id: string; category_id: string; amount_cents: number };
  label: string;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <>
      <div className="flex gap-1">
        <button type="button" className={buttonClass.secondary} onClick={() => setEditing((v) => !v)}>
          {editing ? "Cerrar" : "Cambiar"}
        </button>
        <button
          type="button"
          disabled={pending}
          className={buttonClass.danger}
          aria-label={`Quitar presupuesto de ${label}`}
          onClick={() => startTransition(() => deleteBudget(budget.id))}
        >
          Quitar
        </button>
      </div>
      {editing && (
        <div className="bg-surface-2 rounded-inner mt-3 basis-full p-4">
          <BudgetForm categories={[]} budget={budget} onDone={() => setEditing(false)} />
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Huchas
// ---------------------------------------------------------------------------

export interface GoalValues {
  id: string;
  name: string;
  target_cents: number;
  saved_cents: number;
  account_id: string | null;
  target_date: string | null;
  archived: boolean;
}

export function GoalForm({ accounts, goal, onDone }: { accounts: Option[]; goal?: GoalValues; onDone?: () => void }) {
  const { state, formAction, pending, ref } = useSavedForm(saveGoal, !!goal, onDone);
  const [linked, setLinked] = useState(!!goal?.account_id);
  return (
    <form ref={ref} action={formAction} className="flex flex-col gap-4">
      {goal && <input type="hidden" name="id" value={goal.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre" error={state.errors?.name}>
          <input
            name="name"
            required
            maxLength={60}
            placeholder="Fondo de emergencia"
            defaultValue={goal?.name}
            className={inputClass}
          />
        </Field>
        <Field label="Objetivo" error={state.errors?.target}>
          <input
            name="target"
            required
            inputMode="decimal"
            placeholder="0,00"
            defaultValue={goal ? euros(goal.target_cents) : undefined}
            className={`${inputClass} tabular-nums`}
          />
        </Field>
        <Field label="¿De dónde sale lo ahorrado?">
          <select
            name="account_id"
            defaultValue={goal?.account_id ?? ""}
            onChange={(e) => setLinked(e.target.value !== "")}
            className={inputClass}
          >
            <option value="">Lo apunto yo</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                Saldo de {a.name}
              </option>
            ))}
          </select>
        </Field>
        {!linked && (
          <Field label="Ahorrado hasta ahora" error={state.errors?.saved}>
            <input
              name="saved"
              inputMode="decimal"
              placeholder="0,00"
              defaultValue={goal ? euros(goal.saved_cents) : undefined}
              className={`${inputClass} tabular-nums`}
            />
          </Field>
        )}
        <Field label="Fecha objetivo (opcional)" error={state.errors?.target_date}>
          <input type="date" name="target_date" defaultValue={goal?.target_date ?? ""} className={inputClass} />
        </Field>
      </div>
      <FormMessage state={state} />
      <div>
        <button type="submit" disabled={pending} className={buttonClass.primary}>
          {pending ? "Guardando…" : goal ? "Guardar cambios" : "Crear hucha"}
        </button>
      </div>
    </form>
  );
}

export function GoalActions({ goal, accounts }: { goal: GoalValues; accounts: Option[] }) {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const contribute = (sign: 1 | -1) => {
    const cents = parseAmountToCents(amount);
    if (!cents || cents <= 0) {
      setError("Escribe un importe");
      return;
    }
    setError(null);
    startTransition(async () => {
      await contributeToGoal(goal.id, sign * cents);
      setAmount("");
    });
  };

  return (
    <div className="mt-4 flex flex-col gap-3">
      {!goal.account_id && !goal.archived && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor={`aporte-${goal.id}`}>
            Importe para {goal.name}
          </label>
          <input
            id={`aporte-${goal.id}`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder="0,00"
            className={`${inputClass} w-28 tabular-nums`}
          />
          <button type="button" disabled={pending} className={buttonClass.secondary} onClick={() => contribute(1)}>
            Añadir
          </button>
          <button type="button" disabled={pending} className={buttonClass.secondary} onClick={() => contribute(-1)}>
            Sacar
          </button>
          {error && <span className="text-attention text-xs">{error}</span>}
        </div>
      )}
      <div className="flex flex-wrap gap-1">
        <button type="button" className={buttonClass.secondary} onClick={() => setEditing((v) => !v)}>
          {editing ? "Cerrar" : "Editar"}
        </button>
        <button
          type="button"
          disabled={pending}
          className={buttonClass.secondary}
          onClick={() => startTransition(() => setGoalArchived(goal.id, !goal.archived))}
        >
          {goal.archived ? "Reactivar" : "Archivar"}
        </button>
        <button
          type="button"
          disabled={pending}
          className={buttonClass.danger}
          onClick={() => {
            if (confirm(`¿Borrar la hucha "${goal.name}"?`)) startTransition(() => deleteGoal(goal.id));
          }}
        >
          Borrar
        </button>
      </div>
      {editing && (
        <div className="bg-surface-2 rounded-inner p-4">
          <GoalForm accounts={accounts} goal={goal} onDone={() => setEditing(false)} />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pagos recurrentes
// ---------------------------------------------------------------------------

export interface RecurringValues {
  id: string;
  name: string;
  amount_cents: number;
  frequency: Frequency;
  next_due: string;
  category_id: string | null;
  account_id: string | null;
  match_pattern: string | null;
  active: boolean;
}

export function RecurringForm({
  accounts,
  categoryGroups,
  item,
  today,
  onDone,
}: {
  accounts: Option[];
  categoryGroups: ReturnType<typeof categoryOptions>;
  item?: RecurringValues;
  today: string;
  onDone?: () => void;
}) {
  const { state, formAction, pending, ref } = useSavedForm(saveRecurring, !!item, onDone);
  return (
    <form ref={ref} action={formAction} className="flex flex-col gap-4">
      {item && <input type="hidden" name="id" value={item.id} />}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Nombre" error={state.errors?.name} className="sm:col-span-2">
          <input
            name="name"
            required
            maxLength={60}
            placeholder="Netflix, alquiler, nómina…"
            defaultValue={item?.name}
            className={inputClass}
          />
        </Field>
        <Field label="Tipo">
          <select
            name="direction"
            defaultValue={item && item.amount_cents > 0 ? "ingreso" : "gasto"}
            className={inputClass}
          >
            <option value="gasto">Pago</option>
            <option value="ingreso">Cobro</option>
          </select>
        </Field>
        <Field label="Importe" error={state.errors?.amount}>
          <input
            name="amount"
            required
            inputMode="decimal"
            placeholder="0,00"
            defaultValue={item ? euros(item.amount_cents) : undefined}
            className={`${inputClass} tabular-nums`}
          />
        </Field>
        <Field label="Cada" error={state.errors?.frequency}>
          <select name="frequency" defaultValue={item?.frequency ?? "monthly"} className={inputClass}>
            {FREQUENCIES.map((f) => (
              <option key={f} value={f}>
                {FREQUENCY_LABELS[f]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Próximo cargo" error={state.errors?.next_due}>
          <input type="date" name="next_due" required defaultValue={item?.next_due ?? today} className={inputClass} />
        </Field>
        <Field label="Categoría">
          <select name="category_id" defaultValue={item?.category_id ?? ""} className={inputClass}>
            <option value="">Sin categoría</option>
            <CategoryOptions groups={categoryGroups} />
          </select>
        </Field>
        <Field label="Cuenta">
          <select name="account_id" defaultValue={item?.account_id ?? ""} className={inputClass}>
            <option value="">Cualquiera</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Texto del cargo en el extracto (para darlo por pagado solo)"
          error={state.errors?.match_pattern}
          className="sm:col-span-2 lg:col-span-4"
        >
          <input
            name="match_pattern"
            maxLength={100}
            placeholder="NETFLIX"
            defaultValue={item?.match_pattern ?? ""}
            className={inputClass}
          />
        </Field>
      </div>
      <FormMessage state={state} />
      <div>
        <button type="submit" disabled={pending} className={buttonClass.primary}>
          {pending ? "Guardando…" : item ? "Guardar cambios" : "Añadir pago"}
        </button>
      </div>
    </form>
  );
}

export function RecurringActions({
  item,
  due,
  accounts,
  categoryGroups,
  today,
}: {
  item: RecurringValues;
  due: string;
  accounts: Option[];
  categoryGroups: ReturnType<typeof categoryOptions>;
  today: string;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <>
      <div className="flex flex-wrap gap-1">
        {item.active && (
          <button
            type="button"
            disabled={pending}
            className={buttonClass.secondary}
            onClick={() => startTransition(() => markRecurringPaid(item.id, due))}
          >
            {item.amount_cents > 0 ? "Cobrado" : "Pagado"}
          </button>
        )}
        <button type="button" className={buttonClass.secondary} onClick={() => setEditing((v) => !v)}>
          {editing ? "Cerrar" : "Editar"}
        </button>
        <button
          type="button"
          disabled={pending}
          className={buttonClass.secondary}
          onClick={() => startTransition(() => setRecurringActive(item.id, !item.active))}
        >
          {item.active ? "Pausar" : "Reactivar"}
        </button>
        <button
          type="button"
          disabled={pending}
          className={buttonClass.danger}
          onClick={() => {
            if (confirm(`¿Borrar "${item.name}"?`)) startTransition(() => deleteRecurring(item.id));
          }}
        >
          Borrar
        </button>
      </div>
      {editing && (
        <div className="bg-surface-2 rounded-inner mt-3 basis-full p-4">
          <RecurringForm
            accounts={accounts}
            categoryGroups={categoryGroups}
            item={{ ...item, next_due: due }}
            today={today}
            onDone={() => setEditing(false)}
          />
        </div>
      )}
    </>
  );
}

export function AddSuggestion({ suggestion }: { suggestion: RecurringSuggestion }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className={buttonClass.secondary}
      onClick={() =>
        startTransition(() =>
          addSuggestedRecurring({
            name: suggestion.name,
            pattern: suggestion.pattern,
            amount_cents: suggestion.amount_cents,
            frequency: suggestion.frequency,
            next_due: suggestion.next_due,
            category_id: suggestion.category_id,
            account_id: suggestion.account_id,
          }),
        )
      }
    >
      {pending ? "Añadiendo…" : "Añadir"}
    </button>
  );
}
