import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type Tables = Database["public"]["Tables"];
export type AgentRow = Tables["agents"]["Row"];
export type RunRow = Tables["agent_runs"]["Row"];
export type LogRow = Tables["agent_logs"]["Row"];
export type ActionRow = Tables["agent_actions"]["Row"];

export const getAgents = cache(async (): Promise<AgentRow[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("agents").select("*").order("created_at");
  if (error) throw error;
  return data ?? [];
});

export interface BoardRun extends RunRow {
  lastLog: string | null;
  pendingActions: number;
}

export interface BoardTask {
  id: string;
  prompt: string;
  created_at: string;
  runs: BoardRun[];
}

/** Últimas tareas con sus ejecuciones, la última línea del registro y lo que falta por aprobar. */
export async function getBoard(limit = 15): Promise<BoardTask[]> {
  const supabase = await createClient();
  const { data: tasks, error } = await supabase
    .from("agent_tasks")
    .select("id, prompt, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  if (!tasks?.length) return [];
  const { data: runs } = await supabase
    .from("agent_runs")
    .select("*")
    .in(
      "task_id",
      tasks.map((t) => t.id),
    )
    .order("created_at");
  const runIds = (runs ?? []).map((r) => r.id);
  const [{ data: logs }, { data: actions }] = runIds.length
    ? await Promise.all([
        supabase
          .from("agent_logs")
          .select("run_id, message, created_at")
          .in("run_id", runIds)
          .order("created_at", { ascending: false })
          .limit(500),
        supabase.from("agent_actions").select("run_id").in("run_id", runIds).eq("status", "pending"),
      ])
    : [{ data: [] }, { data: [] }];
  const lastLog = new Map<string, string>();
  for (const l of logs ?? []) if (!lastLog.has(l.run_id)) lastLog.set(l.run_id, l.message);
  const pending = new Map<string, number>();
  for (const a of actions ?? []) pending.set(a.run_id, (pending.get(a.run_id) ?? 0) + 1);
  return tasks.map((t) => ({
    ...t,
    runs: (runs ?? [])
      .filter((r) => r.task_id === t.id)
      .map((r) => ({ ...r, lastLog: lastLog.get(r.id) ?? null, pendingActions: pending.get(r.id) ?? 0 })),
  }));
}

export interface RunDetail {
  run: RunRow;
  prompt: string;
  logs: LogRow[];
  actions: ActionRow[];
}

export async function getRun(runId: string): Promise<RunDetail | null> {
  const supabase = await createClient();
  const { data: run } = await supabase.from("agent_runs").select("*").eq("id", runId).maybeSingle();
  if (!run) return null;
  const [{ data: task }, { data: logs }, { data: actions }] = await Promise.all([
    supabase.from("agent_tasks").select("prompt").eq("id", run.task_id).maybeSingle(),
    supabase.from("agent_logs").select("*").eq("run_id", runId).order("created_at").limit(300),
    supabase.from("agent_actions").select("*").eq("run_id", runId).order("created_at"),
  ]);
  return { run, prompt: task?.prompt ?? "", logs: logs ?? [], actions: actions ?? [] };
}
