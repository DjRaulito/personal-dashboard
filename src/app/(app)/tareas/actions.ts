"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ITEM_STATUSES } from "@/lib/tasks/fields";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

async function session() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return supabase;
}

const refresh = () => {
  revalidatePath("/tareas", "layout");
  revalidatePath("/");
};

export async function setItemStatus(id: string, status: string): Promise<void> {
  const parsed = z.object({ id: z.uuid(), status: z.enum(ITEM_STATUSES) }).parse({ id, status });
  const supabase = await session();
  await supabase.from("task_items").update({ status: parsed.status }).eq("id", parsed.id);
  refresh();
}

/** Criterios que lee la tarea (JSON libre que la IA recibe en get_task_context). */
export async function saveCriteria(slug: string, json: string): Promise<{ ok: boolean; message: string }> {
  let criteria: unknown;
  try {
    criteria = JSON.parse(json || "{}");
  } catch {
    return { ok: false, message: "No es un JSON válido." };
  }
  if (!criteria || typeof criteria !== "object" || Array.isArray(criteria)) {
    return { ok: false, message: "Tiene que ser un objeto: { … }." };
  }
  if (json.length > 20_000) return { ok: false, message: "Demasiado largo." };
  const supabase = await session();
  const { error } = await supabase
    .from("scheduled_tasks")
    .update({ criteria: criteria as Json })
    .eq("slug", slug);
  if (error) return { ok: false, message: "No se pudo guardar." };
  refresh();
  return { ok: true, message: "Criterios guardados: la tarea los leerá en su próxima ejecución." };
}

/** Archivar oculta la tarea del submenú sin borrar su historial. */
export async function setArchived(slug: string, archived: boolean): Promise<void> {
  const supabase = await session();
  await supabase.from("scheduled_tasks").update({ archived }).eq("slug", slug);
  refresh();
}
