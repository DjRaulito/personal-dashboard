import { z } from "zod";
import type { McpServer } from "@/lib/mcp/jsonrpc";
import { cleanItem, fieldsSchema, registerSchema, type TaskField } from "./fields";

// Conector de tareas programadas (dentro del conector único del dashboard). Cualquier IA con un
// token del cerebro registra su tarea y guarda resultados; la app crea la sección sola.
// Esta parte es pura: valida la entrada y llama a `rpc` (la función task_call de Supabase).

export type TaskRpc = (action: string, args: Record<string, unknown>) => Promise<Record<string, unknown>>;

export const TASK_INSTRUCTIONS =
  "Tareas programadas de Raúl. Cada tarea tiene su sección en el dashboard, que se crea sola. " +
  "La primera vez llama a register_task (nombre, identificador, horario, descripción y los campos de sus " +
  "resultados). En cada ejecución empieza con get_task_context, guarda cada resultado con save_item, marca " +
  "con mark_items_removed lo que ya no exista y termina con save_task_summary. Solo datos reales.";

const inputJsonSchema = (schema: z.ZodType) => {
  const json = z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }) as Record<string, unknown>;
  delete json.$schema;
  return json;
};

const taskRef = z.object({ task: z.string().regex(/^[a-z0-9][a-z0-9-]{1,39}$/) });
const saveItemSchema = taskRef.extend({
  key: z.string().trim().min(1).max(300),
  data: z.record(z.string(), z.unknown()),
});
const removedSchema = taskRef.extend({ keys: z.array(z.string().min(1).max(300)).min(1).max(500) });
const summarySchema = taskRef.extend({
  ok: z.boolean().default(true),
  found: z.number().int().min(0).default(0),
  removed: z.number().int().min(0).default(0),
  summary: z.string().trim().max(2000).default(""),
});

export const TASK_TOOLS = [
  {
    name: "register_task",
    description:
      "Crea o actualiza una tarea programada y su sección en el dashboard. task: identificador corto " +
      "(p. ej. «radar-trabajo»); schedule: cuándo corre, en palabras («cada día a las 8:00»); fields: los " +
      "campos de cada resultado [{key, label, type}] con type text | number | money (euros) | area (m²) | " +
      "percent (%) | boolean (sí/no) | url | date. El primer campo text es el título. view (opcional): cards " +
      "(tarjetas con el precio grande), table (comparar cifras) o days (agrupado por día); si no, se deduce.",
    inputSchema: inputJsonSchema(registerSchema),
  },
  {
    name: "get_task_context",
    description:
      "Devuelve la tarea (descripción, campos y criterios que Raúl ha configurado), los resultados ya " +
      "guardados (clave, estado) y las últimas ejecuciones. Llámala al principio de cada ejecución.",
    inputSchema: inputJsonSchema(taskRef),
  },
  {
    name: "save_item",
    description:
      "Guarda o actualiza un resultado. key: identificador estable (p. ej. la URL); data: los campos " +
      "declarados en register_task. Los campos desconocidos o mal tipados se descartan.",
    inputSchema: inputJsonSchema(saveItemSchema),
  },
  {
    name: "mark_items_removed",
    description: "Marca como retirados resultados ya guardados que ya no existen (por su key).",
    inputSchema: inputJsonSchema(removedSchema),
  },
  {
    name: "save_task_summary",
    description: "Al terminar: si fue bien, cuántos resultados nuevos y retirados, y un resumen corto.",
    inputSchema: inputJsonSchema(summarySchema),
  },
] as const;

export const TASK_TOOL_NAMES = new Set<string>(TASK_TOOLS.map((t) => t.name));

const invalid = (error: z.ZodError) => ({
  error: `Datos no válidos: ${error.issues
    .slice(0, 5)
    .map((i) => `${i.path.join(".") || "entrada"}: ${i.message}`)
    .join("; ")}`,
});

export function taskServer(rpc: TaskRpc): Pick<McpServer, "tools" | "call"> {
  // Campos de cada tarea, para validar los resultados sin preguntarlos cada vez
  const fieldsCache = new Map<string, TaskField[]>();
  const fieldsOf = async (task: string) => {
    if (!fieldsCache.has(task)) {
      const ctx = await rpc("context", { task });
      if (typeof ctx.error === "string") return ctx.error;
      const t = (ctx.task ?? {}) as { fields?: unknown };
      fieldsCache.set(task, fieldsSchema.catch([]).parse(t.fields ?? []));
    }
    return fieldsCache.get(task)!;
  };

  return {
    tools: TASK_TOOLS,
    async call(name, args) {
      switch (name) {
        case "register_task": {
          const parsed = registerSchema.safeParse(args);
          if (!parsed.success) return invalid(parsed.error);
          fieldsCache.delete(parsed.data.task);
          return rpc("register_task", parsed.data);
        }
        case "get_task_context": {
          const parsed = taskRef.safeParse(args);
          return parsed.success ? rpc("context", parsed.data) : invalid(parsed.error);
        }
        case "save_item": {
          const parsed = saveItemSchema.safeParse(args);
          if (!parsed.success) return invalid(parsed.error);
          const fields = await fieldsOf(parsed.data.task);
          if (typeof fields === "string") return { error: fields };
          const data = cleanItem(fields, parsed.data.data);
          if (!data) return { error: "Ningún campo válido: usa los campos declarados en register_task." };
          return rpc("save_item", { task: parsed.data.task, key: parsed.data.key, data });
        }
        case "mark_items_removed": {
          const parsed = removedSchema.safeParse(args);
          return parsed.success ? rpc("mark_removed", parsed.data) : invalid(parsed.error);
        }
        case "save_task_summary": {
          const parsed = summarySchema.safeParse(args);
          return parsed.success ? rpc("save_run_summary", parsed.data) : invalid(parsed.error);
        }
        default:
          return { error: "Herramienta desconocida" };
      }
    },
  };
}
