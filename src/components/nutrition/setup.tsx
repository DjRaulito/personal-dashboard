"use client";

import { useState, useTransition } from "react";
import { createPlan, loadCatalog } from "@/app/(app)/nutricion/actions";
import { buttonClass, inputClass } from "@/components/ui";

export function LoadCatalogButton({ label = "Cargar alimentos básicos" }: { label?: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className={buttonClass.secondary}
      onClick={() => startTransition(() => loadCatalog())}
    >
      {pending ? "Cargando…" : label}
    </button>
  );
}

export function CreatePlanForm() {
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <form
      autoComplete="off"
      className="flex flex-wrap gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) startTransition(() => createPlan(name));
      }}
    >
      <label className="sr-only" htmlFor="plan-name">
        Nombre del plan
      </label>
      <input
        id="plan-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={80}
        placeholder="Plan de volumen…"
        className={`${inputClass} max-w-xs`}
      />
      <button type="submit" disabled={pending || !name.trim()} className={buttonClass.primary}>
        {pending ? "Creando…" : "Crear plan"}
      </button>
    </form>
  );
}
