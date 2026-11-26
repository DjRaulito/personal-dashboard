"use client";

import { useTransition } from "react";
import { markAllSeen } from "@/app/(app)/tareas/actions";
import { buttonClass } from "@/components/ui";

/** «Marcar todo como leído»: de una tarea o, sin `slug`, de todas. */
export function MarkAllSeenButton({ slug, count }: { slug?: string; count: number }) {
  const [pending, start] = useTransition();
  if (count <= 0) return null;
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => markAllSeen(slug))}
      className={buttonClass.secondary}
    >
      {pending ? "Marcando…" : `Marcar todo como leído (${count})`}
    </button>
  );
}
