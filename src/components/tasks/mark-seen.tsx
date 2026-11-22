"use client";

import { useEffect, useRef } from "react";
import { setItemStatus } from "@/app/(app)/tareas/actions";
import type { ItemStatus } from "@/lib/tasks/fields";

/** Al abrir un resultado nuevo se marca como visto solo, como un correo en Gmail. */
export function MarkSeen({ id, status }: { id: string; status: ItemStatus }) {
  const done = useRef(false);
  useEffect(() => {
    if (status !== "new" || done.current) return;
    done.current = true;
    void setItemStatus(id, "seen");
  }, [id, status]);
  return null;
}
