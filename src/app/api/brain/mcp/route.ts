import { createClient } from "@supabase/supabase-js";
import { handleMcp, type BrainCall } from "@/lib/brain/mcp";

// Endpoint MCP del cerebro: lo usan Claude, ChatGPT, Cursor, Hermes… con un token (Bearer).
// No hay sesión: la función brain_call de Supabase comprueba el token y solo toca los datos de su dueño.

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return json({ jsonrpc: "2.0", id: null, error: { code: -32001, message: "Falta el token" } }, 401);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key)
    return json({ jsonrpc: "2.0", id: null, error: { code: -32603, message: "Servidor sin configurar" } }, 500);
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const call: BrainCall = async (action, args) => {
    const { data, error } = await supabase.rpc("brain_call", {
      p_token: token,
      p_action: action,
      p_args: { ...args, ...(action === "remember" && !args.source ? { source: "mcp" } : {}) },
    });
    if (error || !data || typeof data !== "object") return { error: "No se pudo completar la acción" };
    return data as Record<string, unknown>;
  };

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "JSON no válido" } }, 400);
  }

  if (Array.isArray(body)) {
    const replies = (await Promise.all(body.slice(0, 20).map((m) => handleMcp(m, call)))).filter(Boolean);
    return replies.length ? json(replies) : new Response(null, { status: 202 });
  }
  const reply = await handleMcp(body, call);
  return reply ? json(reply) : new Response(null, { status: 202 });
}

// El transporte sin estado no abre canal de notificaciones: GET no está soportado
export function GET() {
  return new Response("Método no permitido", { status: 405, headers: { Allow: "POST" } });
}
