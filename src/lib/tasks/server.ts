import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  fieldsSchema,
  ITEM_STATUSES,
  parseHistory,
  pickView,
  type HistoryPoint,
  type ItemStatus,
  type TaskField,
  type TaskView,
} from "./fields";

export interface TaskSummary {
  id: string;
  slug: string;
  name: string;
  description: string;
  schedule: string;
  specialView: string | null;
  archived: boolean;
  lastRun: { ranAt: string; ok: boolean; found: number; removed: number; summary: string } | null;
  newItems: number;
}

export interface TaskItem {
  id: string;
  key: string;
  data: Record<string, unknown>;
  status: ItemStatus;
  firstSeenAt: string;
  lastSeenAt: string;
  removedAt: string | null;
  changedAt: string | null;
  history: HistoryPoint[];
}

export interface TaskDetail extends TaskSummary {
  fields: TaskField[];
  view: TaskView;
  criteria: Record<string, unknown>;
  items: TaskItem[];
  runs: NonNullable<TaskSummary["lastRun"]>[];
}

/**
 * El Radar de inmuebles es anterior a Tareas: si tiene datos y aún no está registrado, se registra
 * como tarea con su vista propia.
 */
async function ensureInmuebles(supabase: Awaited<ReturnType<typeof createClient>>) {
  const [{ count: listings }, { data: existing }] = await Promise.all([
    supabase.from("property_listings").select("id", { count: "exact", head: true }),
    supabase.from("scheduled_tasks").select("id").eq("slug", "inmuebles").maybeSingle(),
  ]);
  if (existing || !listings) return;
  await supabase.from("scheduled_tasks").insert({
    slug: "inmuebles",
    name: "Radar de inmuebles",
    description: "Busca pisos para invertir según tus criterios y calcula su rentabilidad.",
    schedule: "cada día",
    special_view: "inmuebles",
  });
}

export async function getTasks(): Promise<TaskSummary[]> {
  const supabase = await createClient();
  await ensureInmuebles(supabase);
  const [{ data: tasks }, { data: runs }, { data: items }, { data: propertyRuns }, { count: newListings }] =
    await Promise.all([
      supabase
        .from("scheduled_tasks")
        .select("id, slug, name, description, schedule, special_view, archived")
        .order("archived")
        .order("name"),
      supabase
        .from("task_runs")
        .select("task_id, ran_at, ok, found, removed, summary")
        .order("ran_at", { ascending: false })
        .limit(200),
      supabase.from("task_items").select("task_id").eq("status", "new").is("removed_at", null).limit(5000),
      supabase.from("property_runs").select("ran_at, saved, summary").order("ran_at", { ascending: false }).limit(1),
      supabase
        .from("property_listings")
        .select("id", { count: "exact", head: true })
        .eq("status", "nuevo")
        .is("removed_at", null),
    ]);
  const lastRun = new Map<string, TaskSummary["lastRun"]>();
  for (const r of runs ?? []) {
    if (!lastRun.has(r.task_id))
      lastRun.set(r.task_id, { ranAt: r.ran_at, ok: r.ok, found: r.found, removed: r.removed, summary: r.summary });
  }
  const newCount = new Map<string, number>();
  for (const i of items ?? []) newCount.set(i.task_id, (newCount.get(i.task_id) ?? 0) + 1);
  const pr = propertyRuns?.[0];
  return (tasks ?? []).map((t) => {
    const inmuebles = t.special_view === "inmuebles";
    return {
      id: t.id,
      slug: t.slug,
      name: t.name,
      description: t.description,
      schedule: t.schedule,
      specialView: t.special_view,
      archived: t.archived,
      lastRun: inmuebles
        ? pr
          ? { ranAt: pr.ran_at, ok: true, found: pr.saved, removed: 0, summary: pr.summary }
          : null
        : (lastRun.get(t.id) ?? null),
      newItems: inmuebles ? (newListings ?? 0) : (newCount.get(t.id) ?? 0),
    };
  });
}

export async function getTask(slug: string): Promise<TaskDetail | null> {
  const supabase = await createClient();
  const { data: t } = await supabase
    .from("scheduled_tasks")
    .select("id, slug, name, description, schedule, special_view, archived, fields, criteria, view")
    .eq("slug", slug)
    .maybeSingle();
  if (!t) return null;
  const [{ data: items }, { data: runs }] = await Promise.all([
    supabase
      .from("task_items")
      .select("id, item_key, data, status, first_seen_at, last_seen_at, removed_at, changed_at, history")
      .eq("task_id", t.id)
      .order("first_seen_at", { ascending: false })
      .limit(1000),
    supabase
      .from("task_runs")
      .select("ran_at, ok, found, removed, summary")
      .eq("task_id", t.id)
      .order("ran_at", { ascending: false })
      .limit(30),
  ]);
  const fields = fieldsSchema.catch([]).parse(t.fields);
  const runList = (runs ?? []).map((r) => ({
    ranAt: r.ran_at,
    ok: r.ok,
    found: r.found,
    removed: r.removed,
    summary: r.summary,
  }));
  return {
    id: t.id,
    slug: t.slug,
    name: t.name,
    description: t.description,
    schedule: t.schedule,
    specialView: t.special_view,
    archived: t.archived,
    fields,
    view: pickView(fields, t.view),
    criteria: (t.criteria ?? {}) as Record<string, unknown>,
    lastRun: runList[0] ?? null,
    newItems: (items ?? []).filter((i) => i.status === "new" && !i.removed_at).length,
    items: (items ?? []).map((i) => ({
      id: i.id,
      key: i.item_key,
      data: (i.data ?? {}) as Record<string, unknown>,
      status: (ITEM_STATUSES as readonly string[]).includes(i.status) ? (i.status as ItemStatus) : "new",
      firstSeenAt: i.first_seen_at,
      lastSeenAt: i.last_seen_at,
      removedAt: i.removed_at,
      changedAt: i.changed_at,
      history: parseHistory(i.history),
    })),
    runs: runList,
  };
}
