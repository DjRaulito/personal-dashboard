// Piezas puras de los agentes: motores, herramientas, estados, agentes de partida e instrucciones.

import { z } from "zod";

export const MAX_CONCURRENT_RUNS = 3;
/** Una ejecución de Gemini que lleva más de esto «trabajando» se cortó (límite de Vercel). */
export const GEMINI_STALE_MS = 6 * 60 * 1000;
/** Margen para un workflow de Claude Code en GitHub Actions. */
export const CLAUDE_STALE_MS = 75 * 60 * 1000;

export const ENGINES = {
  gemini: { label: "IA gratuita", hint: "Gemini, Groq, Mistral… Rápido, corre en la app y usa tus datos" },
  claude: { label: "Claude Code", hint: "Tareas largas en GitHub Actions sobre el repo" },
} as const;
export type Engine = keyof typeof ENGINES;

export const RUN_STATUS = {
  queued: "En cola",
  working: "Trabajando",
  waiting_approval: "Esperando aprobación",
  done: "Hecho",
  failed: "Fallido",
  cancelled: "Cancelado",
} as const;
export type RunStatus = keyof typeof RUN_STATUS;

export const ACTIVE_STATUSES: RunStatus[] = ["queued", "working"];
export const isFinished = (s: string) => s === "done" || s === "failed" || s === "cancelled";

export interface ToolInfo {
  name: string;
  label: string;
  engine: Engine;
  /** Acción con efecto: el agente solo la propone y Raúl la aprueba. */
  effect?: boolean;
}

export const AGENT_TOOLS: ToolInfo[] = [
  { name: "finanzas_resumen", label: "Resumen de gastos e ingresos", engine: "gemini" },
  { name: "finanzas_movimientos", label: "Movimientos del banco", engine: "gemini" },
  { name: "patrimonio", label: "Patrimonio e inversiones", engine: "gemini" },
  { name: "presupuestos_y_pagos", label: "Presupuestos, huchas y pagos", engine: "gemini" },
  { name: "gimnasio_entrenos", label: "Entrenos", engine: "gemini" },
  { name: "gimnasio_ejercicio", label: "Progreso de un ejercicio", engine: "gemini" },
  { name: "nutricion", label: "Dieta y comidas", engine: "gemini" },
  { name: "cuerpo_y_revisiones", label: "Peso, medidas y revisiones", engine: "gemini" },
  { name: "agenda", label: "Agenda", engine: "gemini" },
  { name: "proponer_presupuesto", label: "Proponer un presupuesto", engine: "gemini", effect: true },
  { name: "proponer_aportacion_hucha", label: "Proponer mover dinero a una hucha", engine: "gemini", effect: true },
  { name: "codigo", label: "Cambiar el código (propone un PR)", engine: "claude", effect: true },
  { name: "web", label: "Buscar en internet", engine: "claude" },
];

export const toolsFor = (engine: Engine) => AGENT_TOOLS.filter((t) => t.engine === engine);

/** Deja solo herramientas que existen para ese motor, sin repetir. */
export function cleanTools(engine: Engine, tools: string[]): string[] {
  const valid = new Set(toolsFor(engine).map((t) => t.name));
  return [...new Set(tools.filter((t) => valid.has(t)))];
}

export const agentFormSchema = z.object({
  id: z
    .uuid()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  name: z.string().trim().min(1, "Ponle un nombre").max(40, "Máximo 40 caracteres"),
  role: z.string().trim().max(120, "Máximo 120 caracteres").default(""),
  instructions: z.string().trim().max(4000, "Máximo 4.000 caracteres").default(""),
  engine: z.enum(["gemini", "claude"]),
  max_steps: z.coerce.number().int().min(1, "Entre 1 y 10").max(10, "Entre 1 y 10"),
  active: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
});

export const taskFormSchema = z.object({
  prompt: z.string().trim().min(3, "Escribe la tarea").max(4000, "Máximo 4.000 caracteres"),
  agents: z.array(z.uuid()).min(1, "Elige al menos un agente").max(10),
});

export interface StarterAgent {
  name: string;
  role: string;
  engine: Engine;
  tools: string[];
  max_steps: number;
  instructions: string;
}

export const STARTER_AGENTS: StarterAgent[] = [
  {
    name: "Analista financiero",
    role: "Gastos, presupuestos, huchas e inversiones",
    engine: "gemini",
    tools: [
      "finanzas_resumen",
      "finanzas_movimientos",
      "patrimonio",
      "presupuestos_y_pagos",
      "proponer_presupuesto",
      "proponer_aportacion_hucha",
    ],
    max_steps: 6,
    instructions:
      "Analiza los gastos, ingresos, presupuestos y la cartera. Busca patrones, gastos raros y margen de ahorro. Si tiene sentido, propone presupuestos o aportaciones a huchas con cifras concretas.",
  },
  {
    name: "Coach de gym y nutrición",
    role: "Entreno, dieta, peso y revisiones",
    engine: "gemini",
    tools: ["gimnasio_entrenos", "gimnasio_ejercicio", "nutricion", "cuerpo_y_revisiones", "agenda"],
    max_steps: 6,
    instructions:
      "Revisa entrenos, progreso de ejercicios, cumplimiento de la dieta y evolución del peso. Da observaciones prácticas y motivadoras, sin consejos médicos.",
  },
  {
    name: "Guionista",
    role: "Ganchos, títulos y guiones",
    engine: "gemini",
    tools: [],
    max_steps: 1,
    instructions:
      "Escribe ganchos, títulos y guiones cortos para YouTube, Instagram y TikTok. Tono cercano y directo, en español de España. Da varias opciones.",
  },
  {
    name: "Desarrollador",
    role: "Programa en el repo del dashboard",
    engine: "claude",
    tools: ["codigo"],
    max_steps: 10,
    instructions:
      "Trabajas sobre este repositorio (Next.js + Supabase). Sigue CLAUDE.md y DESIGN.md. Haz cambios pequeños y verificados (lint, typecheck y tests).",
  },
  {
    name: "Investigador",
    role: "Busca y resume información",
    engine: "claude",
    tools: ["web"],
    max_steps: 10,
    instructions:
      "Investiga el tema en internet, contrasta fuentes y entrega un resumen claro con enlaces a las fuentes.",
  },
];

/** Instrucciones de sistema para un agente de Gemini. */
export function geminiAgentSystem(
  agent: { name: string; role: string; instructions: string },
  today: string,
  weekday: string,
  hasEffects: boolean,
): string {
  return [
    `Eres «${agent.name}», un agente del dashboard personal de Raúl${agent.role ? ` (${agent.role})` : ""}.`,
    `Hoy es ${weekday} ${today} (zona Europe/Madrid).`,
    agent.instructions,
    "Trabajas solo: no puedes hacer preguntas. Si falta información, asume lo razonable y dilo.",
    "Usa las herramientas para leer datos reales; nunca inventes cifras.",
    hasEffects
      ? "Las herramientas «proponer_…» no cambian nada: dejan una propuesta que Raúl aprobará o rechazará. Menciónalas en tu respuesta."
      : "",
    "Entrega el resultado en español: primero la conclusión y después el detalle en viñetas con '- ' y **negrita**. Sin tablas ni títulos.",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Texto que recibe Claude Code en GitHub Actions. Va a un repo público: sin datos personales. */
export function claudeAgentPrompt(
  agent: { name: string; role: string; instructions: string; tools: string[] },
  task: string,
): string {
  const code = agent.tools.includes("codigo");
  return [
    `Eres «${agent.name}»${agent.role ? ` (${agent.role})` : ""}, un agente lanzado desde el dashboard personal de Raúl.`,
    agent.instructions,
    code
      ? "Puedes modificar el código del repositorio. No hagas commit ni push: el workflow guarda tus cambios en una rama y Raúl decide si abre el PR."
      : "No modifiques archivos del repositorio.",
    "No puedes hacer preguntas: si falta información, decide lo razonable y explícalo.",
    "Termina con un resumen en español de lo que has hecho o encontrado (viñetas con '- ').",
    "",
    "Tarea:",
    task,
  ].join("\n");
}

/** Rama donde el workflow deja los cambios de una ejecución. */
export const agentBranch = (runId: string) => `agents/${runId.slice(0, 8)}`;
/** Título del workflow en GitHub, para encontrar la ejecución que corresponde. */
export const workflowTitle = (runId: string) => `agent-${runId}`;

/** Estado de una ejecución que termina según sus acciones pendientes. */
export const statusAfterRun = (pendingActions: number): RunStatus => (pendingActions > 0 ? "waiting_approval" : "done");

/** ¿La ejecución lleva demasiado tiempo trabajando? */
export function isStale(run: { engine: string; status: string; started_at: string | null }, now: number): boolean {
  if (run.status !== "working" || !run.started_at) return false;
  const limit = run.engine === "claude" ? CLAUDE_STALE_MS : GEMINI_STALE_MS;
  return now - new Date(run.started_at).getTime() > limit;
}

/** Cuántas ejecuciones en cola se pueden arrancar ahora. */
export const freeSlots = (working: number) => Math.max(0, MAX_CONCURRENT_RUNS - working);

/** Euros con coma o punto → céntimos. */
export function eurosToCents(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

/** Busca por nombre sin distinguir mayúsculas ni tildes; exacto primero, luego «contiene». */
export function findByName<T extends { name: string }>(items: T[], query: unknown): T | null {
  const norm = (s: string) =>
    s
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .trim();
  const q = norm(String(query ?? ""));
  if (!q) return null;
  return items.find((i) => norm(i.name) === q) ?? items.find((i) => norm(i.name).includes(q)) ?? null;
}
