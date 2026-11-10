"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { agentFormSchema, cleanTools, STARTER_AGENTS, taskFormSchema } from "@/lib/agents/catalog";
import { cancelRun, decideAction, pump, syncClaudeRuns } from "@/lib/agents/runner";
import { fieldErrors, type FormState } from "@/lib/finance/schemas";
import { createClient } from "@/lib/supabase/server";

async function session() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  return supabase;
}

const BOARD = "/ia/agentes";
const id = z.uuid();

// ---------------------------------------------------------------------------
// Fichas de agente
// ---------------------------------------------------------------------------

export async function saveAgent(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = agentFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const supabase = await session();
  const { id: agentId, ...values } = parsed.data;
  const row = { ...values, tools: cleanTools(values.engine, formData.getAll("tools").map(String)) };
  const { error } = agentId
    ? await supabase.from("agents").update(row).eq("id", agentId)
    : await supabase.from("agents").insert(row);
  if (error) {
    return {
      ok: false,
      message: error.code === "23505" ? "Ya tienes un agente con ese nombre." : "No se pudo guardar el agente.",
    };
  }
  revalidatePath(BOARD);
  redirect(BOARD);
}

export async function deleteAgent(agentId: string) {
  const supabase = await session();
  await supabase.from("agents").delete().eq("id", id.parse(agentId));
  revalidatePath(BOARD);
  redirect(BOARD);
}

/** Crea los agentes de partida que falten (no toca los que ya existen). */
export async function createStarterAgents() {
  const supabase = await session();
  await supabase.from("agents").upsert(STARTER_AGENTS, { onConflict: "user_id,name", ignoreDuplicates: true });
  revalidatePath(BOARD);
}

// ---------------------------------------------------------------------------
// Tareas y ejecuciones
// ---------------------------------------------------------------------------

export async function sendTask(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = taskFormSchema.safeParse({ prompt: formData.get("prompt"), agents: formData.getAll("agents") });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const supabase = await session();
  const { data: agents } = await supabase
    .from("agents")
    .select("id, name, engine")
    .in("id", parsed.data.agents)
    .eq("active", true);
  if (!agents?.length) return { ok: false, errors: { agents: "Elige al menos un agente activo" } };
  const { data: task, error } = await supabase
    .from("agent_tasks")
    .insert({ prompt: parsed.data.prompt })
    .select("id")
    .single();
  if (error || !task) return { ok: false, message: "No se pudo crear la tarea." };
  const { error: runsError } = await supabase
    .from("agent_runs")
    .insert(agents.map((a) => ({ task_id: task.id, agent_id: a.id, agent_name: a.name, engine: a.engine })));
  if (runsError) return { ok: false, message: "No se pudo repartir la tarea." };
  // Se responde ya y los agentes trabajan después; el tablero se actualiza en directo
  after(() => pump(supabase));
  revalidatePath(BOARD);
  return { ok: true, message: `Tarea enviada a ${agents.length} agente${agents.length === 1 ? "" : "s"}.` };
}

/** Pone al día Claude Code y arranca lo que esté en cola. La llama el tablero mientras hay trabajo. */
export async function refreshAgents(): Promise<void> {
  const supabase = await session();
  await syncClaudeRuns(supabase);
  after(() => pump(supabase));
}

export async function cancelAgentRun(runId: string) {
  const supabase = await session();
  await cancelRun(supabase, id.parse(runId));
  after(() => pump(supabase));
  revalidatePath(BOARD);
}

export async function decideAgentAction(actionId: string, approve: boolean): Promise<string> {
  const supabase = await session();
  const outcome = await decideAction(supabase, id.parse(actionId), approve);
  revalidatePath(BOARD);
  revalidatePath("/finanzas/plan");
  return outcome;
}

export async function deleteAgentTask(taskId: string) {
  const supabase = await session();
  // Solo tareas sin nada en marcha
  const { count } = await supabase
    .from("agent_runs")
    .select("id", { count: "exact", head: true })
    .eq("task_id", id.parse(taskId))
    .in("status", ["queued", "working"]);
  if (count) return;
  await supabase.from("agent_tasks").delete().eq("id", taskId);
  revalidatePath(BOARD);
}
