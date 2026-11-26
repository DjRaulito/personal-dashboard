"use client";

import { useEffect, useRef } from "react";
import { markListingSeen } from "@/app/(app)/tareas/inmuebles/actions";

/** Al abrir un anuncio sin ver se marca como visto, como un correo. */
export function MarkListingSeen({ id, seen }: { id: string; seen: boolean }) {
  const done = useRef(false);
  useEffect(() => {
    if (seen || done.current) return;
    done.current = true;
    void markListingSeen(id);
  }, [id, seen]);
  return null;
}
