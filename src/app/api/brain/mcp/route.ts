import { createClient } from "@supabase/supabase-js";
import { extractToken, type BrainCall } from "@/lib/brain/mcp";
import { dashboardServer } from "@/lib/mcp/dashboard";
import { respondJsonRpc } from "@/lib/mcp/jsonrpc";
import type { PropertyRpc } from "@/lib/realestate/mcp";

// Endpoint MCP del dashboard (cerebro + inmuebles): lo usan Claude, Cowork, ChatGPT, Cursor… con un token (Bearer).
// No hay sesión: la función brain_call de Supabase comprueba el token y solo toca los datos de su dueño.

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  const token = extractToken(request.headers.get("authorization"), request.url);
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

  const property: PropertyRpc = async (action, args) => {
    const { data, error } = await supabase.rpc("property_call", { p_token: token, p_action: action, p_args: args });
    if (error || !data || typeof data !== "object") return { error: "No se pudo completar la acción" };
    return data as Record<string, unknown>;
  };

  return respondJsonRpc(request, dashboardServer(call, property));
}

// El transporte sin estado no abre canal de notificaciones: GET no está soportado
export function GET() {
  return new Response("Método no permitido", { status: 405, headers: { Allow: "POST" } });
}
