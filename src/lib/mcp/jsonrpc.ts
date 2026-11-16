// Servidor MCP mínimo (JSON-RPC sobre HTTP, sin estado), compartido por los conectores de la app.

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface McpServer {
  info: { name: string; version: string };
  instructions: string;
  tools: readonly McpTool[];
  /** Ejecuta una herramienta; un `error` (texto) en el resultado se marca como isError. */
  call: (name: string, args: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

interface JsonRpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

const ok = (id: JsonRpcRequest["id"], result: unknown) => ({ jsonrpc: "2.0", id: id ?? null, result });
export const rpcError = (id: JsonRpcRequest["id"], code: number, message: string) => ({
  jsonrpc: "2.0",
  id: id ?? null,
  error: { code, message },
});

/**
 * Procesa un mensaje JSON-RPC. Devuelve la respuesta, o null si era una notificación (sin respuesta).
 * Los errores de las herramientas (token, datos) van como resultado con isError, como pide MCP.
 */
export async function handleJsonRpc(msg: unknown, server: McpServer): Promise<Record<string, unknown> | null> {
  if (!msg || typeof msg !== "object" || Array.isArray(msg)) return rpcError(null, -32600, "Mensaje no válido");
  const req = msg as JsonRpcRequest;
  if (typeof req.method !== "string") return rpcError(req.id, -32600, "Falta el método");
  if (req.id === undefined) return null; // notificación

  switch (req.method) {
    case "initialize": {
      const asked = typeof req.params?.protocolVersion === "string" ? req.params.protocolVersion : "2025-03-26";
      return ok(req.id, {
        protocolVersion: asked,
        capabilities: { tools: {} },
        serverInfo: server.info,
        instructions: server.instructions,
      });
    }
    case "ping":
      return ok(req.id, {});
    case "tools/list":
      return ok(req.id, { tools: server.tools });
    case "tools/call": {
      const name = req.params?.name;
      if (typeof name !== "string" || !server.tools.some((t) => t.name === name))
        return rpcError(req.id, -32602, "Herramienta desconocida");
      const args = (req.params?.arguments ?? {}) as Record<string, unknown>;
      const result = await server.call(name, args);
      const isError = typeof result.error === "string";
      return ok(req.id, { content: [{ type: "text", text: JSON.stringify(result) }], isError });
    }
    default:
      return rpcError(req.id, -32601, "Método no soportado");
  }
}

/** Atiende una petición HTTP: un mensaje o un lote (hasta 20). */
export async function respondJsonRpc(request: Request, server: McpServer): Promise<Response> {
  const json = (body: unknown, status = 200) =>
    Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(rpcError(null, -32700, "JSON no válido"), 400);
  }
  if (Array.isArray(body)) {
    const replies = (await Promise.all(body.slice(0, 20).map((m) => handleJsonRpc(m, server)))).filter(Boolean);
    return replies.length ? json(replies) : new Response(null, { status: 202 });
  }
  const reply = await handleJsonRpc(body, server);
  return reply ? json(reply) : new Response(null, { status: 202 });
}
