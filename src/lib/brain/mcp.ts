// Servidor MCP del cerebro (JSON-RPC sobre HTTP, sin estado). Esta parte es pura: recibe el mensaje
// y una función `call` que ejecuta la acción en la base de datos (brain_call).

export type BrainCall = (action: string, args: Record<string, unknown>) => Promise<Record<string, unknown>>;

interface JsonRpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

export const SERVER_INFO = { name: "cerebro-dashboard", version: "1.0.0" };

const str = (description: string) => ({ type: "string", description });

export const BRAIN_TOOLS = [
  {
    name: "remember",
    description:
      "Guarda un recuerdo en el cerebro de Raúl. Si ya existe uno con ese título, lo actualiza. Úsalo para hechos, preferencias, decisiones o contexto que merezca la pena recordar en otras conversaciones. Nunca guardes contraseñas ni claves.",
    inputSchema: {
      type: "object",
      properties: {
        title: str("Título corto y único (máx. 80 caracteres)"),
        content: str("Contenido del recuerdo (máx. 2000 caracteres)"),
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Hasta 8 etiquetas. Las que se comparten conectan recuerdos.",
        },
        related: { type: "array", items: { type: "string" }, description: "Ids de recuerdos relacionados" },
        source: str("Quién lo guarda, p. ej. «claude» o «chatgpt»"),
      },
      required: ["title", "content"],
    },
  },
  {
    name: "search",
    description: "Busca recuerdos por palabras (todas deben aparecer en título, contenido o etiquetas).",
    inputSchema: {
      type: "object",
      properties: {
        query: str("Palabras a buscar"),
        limit: { type: "number", description: "Máx. 25 (10 por defecto)" },
      },
      required: ["query"],
    },
  },
  {
    name: "list",
    description: "Lista los recuerdos más recientes (título y etiquetas), opcionalmente de una etiqueta.",
    inputSchema: {
      type: "object",
      properties: {
        tag: str("Etiqueta a filtrar"),
        limit: { type: "number", description: "Máx. 25 (10 por defecto)" },
      },
    },
  },
  {
    name: "get",
    description: "Devuelve un recuerdo completo con los recuerdos conectados a él.",
    inputSchema: { type: "object", properties: { id: str("Id del recuerdo") }, required: ["id"] },
  },
  {
    name: "link",
    description: "Conecta dos recuerdos entre sí.",
    inputSchema: {
      type: "object",
      properties: { a: str("Id del primer recuerdo"), b: str("Id del segundo recuerdo") },
      required: ["a", "b"],
    },
  },
  {
    name: "forget",
    description: "Borra un recuerdo para siempre.",
    inputSchema: { type: "object", properties: { id: str("Id del recuerdo") }, required: ["id"] },
  },
  {
    name: "forget_all",
    description: "Borra TODA la memoria al instante. Solo si Raúl lo pide de forma explícita.",
    inputSchema: {
      type: "object",
      properties: { confirm: { type: "boolean", description: "Debe ser true" } },
      required: ["confirm"],
    },
  },
] as const;

const TOOL_NAMES = new Set<string>(BRAIN_TOOLS.map((t) => t.name));

const ok = (id: JsonRpcRequest["id"], result: unknown) => ({ jsonrpc: "2.0", id: id ?? null, result });
const fail = (id: JsonRpcRequest["id"], code: number, message: string) => ({
  jsonrpc: "2.0",
  id: id ?? null,
  error: { code, message },
});

/**
 * Procesa un mensaje JSON-RPC. Devuelve la respuesta, o null si era una notificación (sin respuesta).
 * Los errores de las herramientas (token, datos) van como resultado con isError, como pide MCP.
 */
export async function handleMcp(msg: unknown, call: BrainCall): Promise<Record<string, unknown> | null> {
  if (!msg || typeof msg !== "object" || Array.isArray(msg)) return fail(null, -32600, "Mensaje no válido");
  const req = msg as JsonRpcRequest;
  if (typeof req.method !== "string") return fail(req.id, -32600, "Falta el método");
  if (req.id === undefined) return null; // notificación

  switch (req.method) {
    case "initialize": {
      const asked = typeof req.params?.protocolVersion === "string" ? req.params.protocolVersion : "2025-03-26";
      return ok(req.id, {
        protocolVersion: asked,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
        instructions:
          "Memoria personal de Raúl. Antes de responder sobre su vida, gustos o proyectos, busca con «search». Guarda con «remember» lo que valga la pena recordar.",
      });
    }
    case "ping":
      return ok(req.id, {});
    case "tools/list":
      return ok(req.id, { tools: BRAIN_TOOLS });
    case "tools/call": {
      const name = req.params?.name;
      if (typeof name !== "string" || !TOOL_NAMES.has(name)) return fail(req.id, -32602, "Herramienta desconocida");
      const args = (req.params?.arguments ?? {}) as Record<string, unknown>;
      const result = await call(name, args);
      const isError = typeof result.error === "string";
      return ok(req.id, { content: [{ type: "text", text: JSON.stringify(result) }], isError });
    }
    default:
      return fail(req.id, -32601, "Método no soportado");
  }
}

/** Token de la petición: cabecera Bearer o, para clientes que solo admiten una dirección, `?token=`. */
export function extractToken(authorization: string | null, url: string): string | null {
  const bearer = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (bearer) return bearer;
  try {
    const q = new URL(url).searchParams.get("token");
    return q && /^brain_[\w-]+$/.test(q) ? q : null;
  } catch {
    return null;
  }
}
