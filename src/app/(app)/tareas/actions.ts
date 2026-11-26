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

/**
 * Marca como leídos los resultados nuevos de una tarea (o de todas si no se indica).
 * En el radar de inmuebles se marca `seen_at`, sin tocar el estado de decisión.
 */
export async function markAllSeen(slug?: string): Promise<void> {
  const parsedSlug = z.string().trim().min(1).max(80).optional().parse(slug);
  const supabase = await session();
  const now = new Date().toISOString();
  let taskId: string | null = null;
  let properties = !parsedSlug;
  if (parsedSlug) {
    const { data } = await supabase
      .from("scheduled_tasks")
      .select("id, special_view")
      .eq("slug", parsedSlug)
      .maybeSingle();
    if (!data) return;
    if (data.special_view === "inmuebles") properties = true;
    else taskId = data.id;
  }
  await Promise.all([
    properties && supabase.from("property_listings").update({ seen_at: now }).is("seen_at", null),
    (!parsedSlug || taskId) &&
      (taskId
        ? supabase.from("task_items").update({ status: "seen" }).eq("status", "new").eq("task_id", taskId)
        : supabase.from("task_items").update({ status: "seen" }).eq("status", "new")),
  ]);
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
