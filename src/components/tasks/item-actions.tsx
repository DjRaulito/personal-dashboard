"use client";

import { useOptimistic, useTransition } from "react";
import { setItemStatus } from "@/app/(app)/tareas/actions";
import { StatusButtons } from "@/components/tasks/task-items";
import type { ItemStatus } from "@/lib/tasks/fields";
import type { TaskItem } from "@/lib/tasks/server";

/** Favorito / Visto / Descartar en la ficha de un resultado. */
export function ItemActions({ item }: { item: TaskItem }) {
  const [pending, start] = useTransition();
  const [status, setStatus] = useOptimistic(item.status);
  return (
    <StatusButtons
      item={{ ...item, status }}
      pending={pending}
      big
      onStatus={(id: string, next: ItemStatus) =>
        start(async () => {
          setStatus(next);
          await setItemStatus(id, next);
        })
      }
    />
  );
}
