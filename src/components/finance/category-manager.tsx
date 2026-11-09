"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { applyRulesToUncategorized, deleteCategory, deleteRule, saveCategory } from "@/app/(app)/finanzas/actions";
import { buttonClass, Field, FormMessage, inputClass } from "@/components/ui";
import { KIND_LABELS, type CategoryKind, type CategoryNode } from "@/lib/finance/categories";

export function NewCategoryForm({ roots }: { roots: CategoryNode[] }) {
  const [state, action, pending] = useActionState(saveCategory, { ok: false });
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Nombre" error={state.errors?.name}>
          <input name="name" required maxLength={60} className={inputClass} />
        </Field>
        <Field label="Dentro de">
          <select name="parent_id" defaultValue="" className={inputClass}>
            <option value="">Ninguna (categoría principal)</option>
            {roots.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tipo (si es principal)">
          <select name="kind" defaultValue="expense" className={inputClass}>
            {(Object.keys(KIND_LABELS) as CategoryKind[]).map((k) => (
              <option key={k} value={k}>
                {KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <FormMessage state={state} />
      <div>
        <button type="submit" disabled={pending} className={buttonClass.primary}>
          {pending ? "Guardando…" : "Crear categoría"}
        </button>
      </div>
    </form>
  );
}

export function CategoryItem({ id, name, isRoot }: { id: string; name: string; isRoot: boolean }) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(saveCategory, { ok: false });
  const [deleting, startTransition] = useTransition();
  useEffect(() => {
    if (state.ok) setEditing(false);
  }, [state]);

  if (editing) {
    return (
      <form action={action} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="kind" value="expense" />
        <input
          name="name"
          defaultValue={name}
          required
          maxLength={60}
          aria-label="Nombre"
          className={`${inputClass} w-auto py-1.5`}
        />
        <button type="submit" disabled={pending} className={buttonClass.secondary}>
          Guardar
        </button>
        <button type="button" onClick={() => setEditing(false)} className="text-muted text-xs hover:underline">
          Cancelar
        </button>
        {state.message && !state.ok && <span className="text-attention text-xs">{state.message}</span>}
      </form>
    );
  }

  return (
    <span className="group inline-flex items-center gap-2">
      <span className={isRoot ? "font-semibold" : undefined}>{name}</span>
      <button type="button" onClick={() => setEditing(true)} className="text-muted text-xs hover:underline">
        Renombrar
      </button>
      <button
        type="button"
        disabled={deleting}
        onClick={() => {
          const msg = isRoot
            ? `¿Borrar "${name}", sus subcategorías y sus reglas? Los movimientos quedarán sin categoría.`
            : `¿Borrar "${name}" y sus reglas? Los movimientos quedarán sin categoría.`;
          if (confirm(msg)) startTransition(() => deleteCategory(id));
        }}
        className="text-expense text-xs hover:underline"
      >
        Borrar
      </button>
    </span>
  );
}

export function DeleteRuleButton({ id, pattern }: { id: string; pattern: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      aria-label={`Borrar regla ${pattern}`}
      onClick={() => startTransition(() => deleteRule(id))}
      className="text-expense text-xs hover:underline"
    >
      Borrar
    </button>
  );
}

export function ApplyRulesButton({ uncategorized }: { uncategorized: number }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<number | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={pending || uncategorized === 0}
        onClick={() => startTransition(async () => setResult(await applyRulesToUncategorized()))}
        className={buttonClass.secondary}
      >
        {pending ? "Aplicando…" : "Aplicar reglas a los no categorizados"}
      </button>
      <span role="status" className="text-muted text-sm">
        {result !== null
          ? `${result} movimientos categorizados.`
          : `${uncategorized.toLocaleString("es-ES")} sin categoría.`}
      </span>
    </div>
  );
}
