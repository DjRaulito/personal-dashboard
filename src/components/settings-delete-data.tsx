"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteModuleData } from "@/app/(app)/ajustes/actions";
import { buttonClass, Field, FormMessage, inputClass } from "@/components/ui";
import { confirmWord, MODULE_TABLES, type DataModule } from "@/lib/settings/data";

/** Borrar todos los datos de un módulo, con confirmación escrita. */
export function DeleteModuleData() {
  const [module, setModule] = useState<DataModule>("armario");
  const [confirm, setConfirm] = useState("");
  const [state, setState] = useState<{ ok: boolean; message?: string }>({ ok: true });
  const [pending, start] = useTransition();
  const word = confirmWord(module);

  return (
    <form
      className="flex max-w-md flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const result = await deleteModuleData({ module, confirm });
          setState(result);
          if (result.ok) setConfirm("");
        });
      }}
    >
      <Field label="Módulo">
        <select
          value={module}
          onChange={(e) => {
            setModule(e.target.value as DataModule);
            setConfirm("");
          }}
          className={inputClass}
        >
          {(Object.keys(MODULE_TABLES) as DataModule[]).map((m) => (
            <option key={m} value={m}>
              {MODULE_TABLES[m].label}
            </option>
          ))}
        </select>
      </Field>
      <Field label={`Escribe «${word}» para confirmar`}>
        <input
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          className={inputClass}
        />
      </Field>
      <button
        type="submit"
        disabled={pending || confirm.trim().toLowerCase() !== word}
        className={`${buttonClass.danger} self-start`}
      >
        <Trash2 aria-hidden="true" className="h-4 w-4" />
        {pending ? "Borrando…" : `Borrar ${MODULE_TABLES[module].label}`}
      </button>
      <FormMessage state={state} />
    </form>
  );
}
