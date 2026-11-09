"use client";

import { useTransition } from "react";
import { deleteOperation } from "@/app/(app)/finanzas/inversiones/actions";

export function DeleteOperationButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => confirm("¿Borrar esta operación?") && start(() => deleteOperation(id))}
      className="text-expense text-xs hover:underline"
    >
      Borrar
    </button>
  );
}
