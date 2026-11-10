import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { chatWithTools, type AiTool } from "@/lib/ai/llm";
import { assistantTools } from "@/lib/ai/tools";
import { dayKey } from "@/lib/datetime";
import type { Database, Json } from "@/lib/supabase/database.types";
import {
  agentBranch,
  claudeAgentPrompt,
  eurosToCents,
  findByName,
  freeSlots,
  geminiAgentSystem,
  isStale,
  statusAfterRun,
  type Engine,
} from "./catalog";
import {
  cancelWorkflowRun,
  claudeConfigured,
  dispatchWorkflow,
  downloadResult,
  findWorkflowRun,
  getWorkflowRun,
  openPullRequest,
} from "./github";

// Cola de ejecuciones: arranca las que caben (límite de concurrencia), corre las de Gemini
// dentro de la petición y manda las de Claude Code a GitHub Actions. Todo pasa por el cliente
// de Supabase con la sesión de Raúl, así que la RLS sigue mandando.

type Db = SupabaseClient<Database>;
type RunRow = Database["public"]["Tables"]["agent_runs"]["Row"];

const nowIso = () => new Date().toISOString();
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export async function addLog(db: Db, runId: string, message: string, kind: "info" | "tool" | "error" = "info") {
  await db.from("agent_logs").insert({ run_id: runId, kind, message: clip(message, 2000) });
}

/** Cierra una ejecución que sigue «trabajando» (si se canceló mientras tanto, no se toca). */
async function finish(db: Db, runId: string, values: Partial<RunRow>) {
  await db
    .from("agent_runs")
    .update({ ...values, finished_at: nowIso() })
    .eq("id", runId)
    .eq("status", "working");
}

async function fail(db: Db, runId: string, message: string) {
  await addLog(db, runId, message, "error");
  await finish(db, runId, { status: "failed", error: clip(message, 1000) });
}

// ---------------------------------------------------------------------------
// Herramientas con efecto: solo dejan una propuesta pendiente de aprobar
// ---------------------------------------------------------------------------

function effectTools(db: Db, runId: string): AiTool[] {
  const propose = async (kind: string, summary: string, payload: Json) => {
    const { error } = await db.from("agent_actions").insert({ run_id: runId, kind, summary, payload });
    if (error) throw new Error("No se pudo registrar la propuesta");
    await addLog(db, runId, `Propuesta: ${summary}`, "tool");
    return { ok: true, nota: "Propuesta registrada. Raúl la aprobará o rechazará." };
  };
  return [
    {
      name: "proponer_presupuesto",
      description:
        "Propone fijar el presupuesto mensual de una categoría principal de gasto. No cambia nada hasta que Raúl lo aprueba.",
      parameters: {
        type: "object",
        properties: {
          categoria: { type: "string", description: "Nombre de la categoría principal (p. ej. Alimentación)" },
          importe_eur: { type: "number", description: "Presupuesto mensual en euros" },
          motivo: { type: "string", description: "Por qué (una frase)" },
        },
        required: ["categoria", "importe_eur"],
      },
      run: async (args) => {
        const { data: cats } = await db.from("categories").select("id, name, kind, parent_id");
        const main = (cats ?? []).filter((c) => !c.parent_id && c.kind === "expense");
        const cat = findByName(main, args.categoria);
        if (!cat) return { error: `No hay categoría principal de gasto «${args.categoria}».` };
        const cents = eurosToCents(args.importe_eur);
        if (!cents || cents <= 0 || cents >= 1e9) return { error: "Importe no válido." };
        const reason = typeof args.motivo === "string" ? ` (${clip(args.motivo, 120)})` : "";
        return propose(
          "budget",
          clip(`Presupuesto de ${cat.name}: ${(cents / 100).toLocaleString("es-ES")} €/mes${reason}`, 300),
          { category_id: cat.id, amount_cents: cents },
        );
      },
    },
    {
      name: "proponer_aportacion_hucha",
      description:
        "Propone sumar (o restar, con importe negativo) dinero a una hucha que se lleva a mano. No cambia nada hasta que Raúl lo aprueba.",
      parameters: {
        type: "object",
        properties: {
          hucha: { type: "string", description: "Nombre de la hucha" },
          importe_eur: { type: "number", description: "Euros a sumar (negativo para restar)" },
          motivo: { type: "string", description: "Por qué (una frase)" },
        },
        required: ["hucha", "importe_eur"],
      },
      run: async (args) => {
        const { data: goals } = await db
          .from("savings_goals")
          .select("id, name, account_id")
          .eq("archived", false)
          .is("account_id", null);
        const goal = findByName(goals ?? [], args.hucha);
        if (!goal) return { error: `No hay ninguna hucha a mano llamada «${args.hucha}».` };
        const cents = eurosToCents(args.importe_eur);
        if (!cents || Math.abs(cents) >= 1e11) return { error: "Importe no válido." };
        const reason = typeof args.motivo === "string" ? ` (${clip(args.motivo, 120)})` : "";
        const verb = cents > 0 ? "Sumar" : "Restar";
        return propose(
          "goal_contribution",
          clip(`${verb} ${(Math.abs(cents) / 100).toLocaleString("es-ES")} € a la hucha ${goal.name}${reason}`, 300),
          { goal_id: goal.id, cents },
        );
      },
    },
  ];
}

// ---------------------------------------------------------------------------
// Motores
// ---------------------------------------------------------------------------

interface AgentRow {
  name: string;
  role: string;
  instructions: string;
  engine: string;
  tools: string[];
  max_steps: number;
}

async function runGemini(db: Db, run: RunRow, agent: AgentRow, prompt: string) {
  const now = new Date();
  const today = dayKey(now);
  const weekday = new Intl.DateTimeFormat("es-ES", { weekday: "long", timeZone: "Europe/Madrid" }).format(now);
  const allowed = new Set(agent.tools);
  const tools = [...assistantTools(today), ...effectTools(db, run.id)].filter((t) => allowed.has(t.name));
  const hasEffects = tools.some((t) => t.name.startsWith("proponer_"));
  await addLog(db, run.id, tools.length ? `Empieza con ${tools.length} herramientas` : "Empieza");
  const res = await chatWithTools(
    geminiAgentSystem(agent, today, weekday, hasEffects),
    [{ role: "user", text: prompt }],
    tools,
    {
      maxRounds: agent.max_steps,
      onTool: (name) => (name.startsWith("proponer_") ? undefined : addLog(db, run.id, `Consulta ${name}`, "tool")),
    },
  );
  const { count } = await db
    .from("agent_actions")
    .select("id", { count: "exact", head: true })
    .eq("run_id", run.id)
    .eq("status", "pending");
  await addLog(db, run.id, count ? `Terminado: ${count} propuesta(s) por aprobar` : "Terminado");
  await finish(db, run.id, { status: statusAfterRun(count ?? 0), result: clip(res.text, 40000) });
}

async function dispatchClaude(db: Db, run: RunRow, agent: AgentRow, prompt: string) {
  if (!claudeConfigured()) {
    throw new Error("Falta configurar GITHUB_AGENT_TOKEN en Vercel para los agentes de Claude Code.");
  }
  const branch = agentBranch(run.id);
  await dispatchWorkflow({
    runId: run.id,
    prompt: claudeAgentPrompt(agent, prompt),
    maxTurns: Math.max(3, agent.max_steps * 3),
    allowCode: agent.tools.includes("codigo"),
    allowWeb: agent.tools.includes("web"),
    branch,
  });
  await db.from("agent_runs").update({ branch }).eq("id", run.id);
  await addLog(db, run.id, "Enviado a GitHub Actions; Claude Code arrancará en unos segundos");
}

/** Intenta quedarse con una ejecución en cola (evita que dos peticiones arranquen la misma). */
async function claim(db: Db, runId: string): Promise<RunRow | null> {
  const { data } = await db
    .from("agent_runs")
    .update({ status: "working", started_at: nowIso() })
    .eq("id", runId)
    .eq("status", "queued")
    .select()
    .maybeSingle();
  return data;
}

async function execute(db: Db, queued: RunRow) {
  const run = await claim(db, queued.id);
  if (!run) return;
  try {
    const [{ data: agent }, { data: task }] = await Promise.all([
      run.agent_id
        ? db
            .from("agents")
            .select("name, role, instructions, engine, tools, max_steps")
            .eq("id", run.agent_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      db.from("agent_tasks").select("prompt").eq("id", run.task_id).single(),
    ]);
    if (!agent) throw new Error("El agente ya no existe.");
    if (!task) throw new Error("La tarea ya no existe.");
    if ((run.engine as Engine) === "claude") await dispatchClaude(db, run, agent, task.prompt);
    else await runGemini(db, run, agent, task.prompt);
  } catch (e) {
    await fail(db, run.id, e instanceof Error ? e.message : "Error inesperado");
  }
}

// ---------------------------------------------------------------------------
// Cola
// ---------------------------------------------------------------------------

/** Marca como fallidas las ejecuciones que se quedaron colgadas. */
async function failStale(db: Db) {
  const { data } = await db.from("agent_runs").select("*").eq("status", "working");
  const now = Date.now();
  for (const run of data ?? []) {
    if (isStale(run, now)) await fail(db, run.id, "Se cortó sin terminar (tiempo agotado).");
  }
}

const PUMP_BUDGET_MS = 25000;

/** Arranca ejecuciones en cola mientras haya hueco y tiempo en esta petición. */
export async function pump(db: Db) {
  const started = Date.now();
  await failStale(db);
  while (Date.now() - started < PUMP_BUDGET_MS) {
    const { count } = await db.from("agent_runs").select("id", { count: "exact", head: true }).eq("status", "working");
    const slots = freeSlots(count ?? 0);
    if (slots === 0) return;
    const { data: queued } = await db
      .from("agent_runs")
      .select("*")
      .eq("status", "queued")
      .order("created_at")
      .limit(slots);
    if (!queued?.length) return;
    await Promise.all(queued.map((r) => execute(db, r)));
  }
}

/** Pone al día las ejecuciones de Claude Code consultando GitHub. */
export async function syncClaudeRuns(db: Db) {
  if (!claudeConfigured()) return;
  const { data } = await db.from("agent_runs").select("*").eq("status", "working").eq("engine", "claude");
  for (const run of data ?? []) {
    try {
      const wf = run.github_run_id
        ? await getWorkflowRun(run.github_run_id)
        : await findWorkflowRun(run.id, run.started_at ?? run.created_at);
      if (!wf) continue;
      if (!run.github_run_id) {
        await db.from("agent_runs").update({ github_run_id: wf.id, github_url: wf.url }).eq("id", run.id);
        await addLog(db, run.id, "Claude Code está trabajando en GitHub Actions");
      }
      if (wf.status !== "completed") continue;
      const artifact = await downloadResult(wf.id);
      if (wf.conclusion !== "success") {
        if (artifact?.result) await finish(db, run.id, { result: clip(artifact.result, 40000) });
        await fail(db, run.id, `El workflow terminó con estado «${wf.conclusion ?? "desconocido"}».`);
        continue;
      }
      let pending = 0;
      if (artifact?.branchPushed && run.branch) {
        await db.from("agent_actions").insert({
          run_id: run.id,
          kind: "pull_request",
          summary: clip(`Abrir un PR con los cambios de ${run.agent_name} (rama ${run.branch})`, 300),
          payload: { branch: run.branch },
        });
        pending = 1;
        await addLog(db, run.id, `Cambios guardados en la rama ${run.branch}`);
      }
      await addLog(db, run.id, "Terminado");
      await finish(db, run.id, {
        status: statusAfterRun(pending),
        result: clip(artifact?.result || "Claude Code terminó sin resumen.", 40000),
      });
    } catch (e) {
      console.error("[agentes]", e instanceof Error ? e.message : e);
    }
  }
}

/** Cancela una ejecución (y su workflow, si ya estaba en GitHub). */
export async function cancelRun(db: Db, runId: string) {
  const { data: run } = await db
    .from("agent_runs")
    .update({ status: "cancelled", finished_at: nowIso() })
    .eq("id", runId)
    .in("status", ["queued", "working", "waiting_approval"])
    .select()
    .maybeSingle();
  if (!run) return;
  await db
    .from("agent_actions")
    .update({ status: "rejected", decided_at: nowIso() })
    .eq("run_id", runId)
    .eq("status", "pending");
  await addLog(db, runId, "Cancelada por Raúl");
  if (run.engine === "claude" && run.github_run_id && claudeConfigured()) {
    await cancelWorkflowRun(run.github_run_id).catch(() => undefined);
  }
}

// ---------------------------------------------------------------------------
// Aprobaciones
// ---------------------------------------------------------------------------

async function applyAction(db: Db, action: { kind: string; payload: Json; run_id: string }): Promise<string> {
  const p = (action.payload ?? {}) as Record<string, unknown>;
  if (action.kind === "budget") {
    const { error } = await db
      .from("budgets")
      .upsert(
        { category_id: String(p.category_id), amount_cents: Number(p.amount_cents) },
        { onConflict: "user_id,category_id" },
      );
    if (error) throw new Error("No se pudo guardar el presupuesto.");
    return "Presupuesto guardado.";
  }
  if (action.kind === "goal_contribution") {
    const { data: goal } = await db
      .from("savings_goals")
      .select("saved_cents")
      .eq("id", String(p.goal_id))
      .maybeSingle();
    if (!goal) throw new Error("La hucha ya no existe.");
    const { error } = await db
      .from("savings_goals")
      .update({ saved_cents: Math.max(0, goal.saved_cents + Number(p.cents)) })
      .eq("id", String(p.goal_id));
    if (error) throw new Error("No se pudo actualizar la hucha.");
    return "Hucha actualizada.";
  }
  if (action.kind === "pull_request") {
    const { data: run } = await db
      .from("agent_runs")
      .select("agent_name, result, task_id")
      .eq("id", action.run_id)
      .single();
    const { data: task } = await db
      .from("agent_tasks")
      .select("prompt")
      .eq("id", run?.task_id ?? "")
      .maybeSingle();
    const title = clip(`${run?.agent_name ?? "Agente"}: ${(task?.prompt ?? "cambios").split("\n")[0]}`, 120);
    const body = clip(`${run?.result ?? ""}\n\n_Abierto desde el centro de agentes del dashboard._`, 60000);
    return `PR abierto: ${await openPullRequest(String(p.branch), title, body)}`;
  }
  throw new Error("Acción desconocida.");
}

/** Aprueba (y ejecuta) o rechaza una acción propuesta. Cierra la ejecución si no queda nada pendiente. */
export async function decideAction(db: Db, actionId: string, approve: boolean): Promise<string> {
  const { data: action } = await db
    .from("agent_actions")
    .select("id, kind, payload, run_id, status")
    .eq("id", actionId)
    .maybeSingle();
  if (!action || action.status !== "pending") return "Esta acción ya estaba decidida.";
  let status: "approved" | "rejected" | "failed" = approve ? "approved" : "rejected";
  let outcome = approve ? "" : "Rechazada.";
  if (approve) {
    try {
      outcome = await applyAction(db, action);
    } catch (e) {
      status = "failed";
      outcome = e instanceof Error ? e.message : "No se pudo aplicar.";
    }
  }
  await db
    .from("agent_actions")
    .update({ status, outcome: clip(outcome, 500), decided_at: nowIso() })
    .eq("id", action.id)
    .eq("status", "pending");
  await addLog(
    db,
    action.run_id,
    `${approve ? "Aprobada" : "Rechazada"}: ${outcome}`,
    status === "failed" ? "error" : "info",
  );
  const { count } = await db
    .from("agent_actions")
    .select("id", { count: "exact", head: true })
    .eq("run_id", action.run_id)
    .eq("status", "pending");
  if (!count) {
    await db.from("agent_runs").update({ status: "done" }).eq("id", action.run_id).eq("status", "waiting_approval");
  }
  return outcome;
}
