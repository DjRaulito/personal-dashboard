import { createClient } from "@supabase/supabase-js";
import { extractToken } from "@/lib/brain/mcp";
import { respondJsonRpc, rpcError } from "@/lib/mcp/jsonrpc";
import { propertyServer, type PropertyRpc } from "@/lib/realestate/mcp";

// Endpoint MCP de inmuebles: lo usa la tarea diaria de Cowork con un token del cerebro (Bearer).
// No hay sesión: la función property_call de Supabase comprueba el token y solo toca los datos de su dueño.

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const json = (body: unknown, status: number) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  const token = extractToken(request.headers.get("authorization"), request.url);
  if (!token) return json(rpcError(null, -32001, "Falta el token"), 401);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return json(rpcError(null, -32603, "Servidor sin configurar"), 500);
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const rpc: PropertyRpc = async (action, args) => {
    const { data, error } = await supabase.rpc("property_call", { p_token: token, p_action: action, p_args: args });
    if (error || !data || typeof data !== "object") return { error: "No se pudo completar la acción" };
    return data as Record<string, unknown>;
  };

  return respondJsonRpc(request, propertyServer(rpc));
}

// El transporte sin estado no abre canal de notificaciones: GET no está soportado
export function GET() {
  return new Response("Método no permitido", { status: 405, headers: { Allow: "POST" } });
}
