import { BRAIN_TOOLS, SERVER_INFO, type BrainCall } from "@/lib/brain/mcp";
import { PROPERTY_INSTRUCTIONS, propertyServer, type PropertyRpc } from "@/lib/realestate/mcp";
import type { McpServer } from "./jsonrpc";

// Conector único del dashboard (dirección del cerebro): memoria + inmuebles con el mismo token.
// Así basta con un conector en Claude/Cowork para todo.

const BRAIN_INSTRUCTIONS =
  "Memoria personal de Raúl. Antes de responder sobre su vida, gustos o proyectos, busca con «search». Guarda con «remember» lo que valga la pena recordar.";

export function dashboardServer(brain: BrainCall, property: PropertyRpc): McpServer {
  const properties = propertyServer(property);
  const brainNames = new Set<string>(BRAIN_TOOLS.map((t) => t.name));
  return {
    info: SERVER_INFO,
    instructions: `${BRAIN_INSTRUCTIONS}\n\n${PROPERTY_INSTRUCTIONS}`,
    tools: [...BRAIN_TOOLS, ...properties.tools],
    call: (name, args) => (brainNames.has(name) ? brain(name, args) : properties.call(name, args)),
  };
}
