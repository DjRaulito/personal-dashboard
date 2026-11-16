import { z } from "zod";
import type { McpServer } from "@/lib/mcp/jsonrpc";
import {
  criteriaSchema,
  listingInputSchema,
  parseZones,
  removedInputSchema,
  runInputSchema,
  toListingData,
} from "./schemas";

// Conector MCP de inmuebles: la tarea diaria de Cowork busca y guarda datos; la app hace las cuentas.
// Esta parte es pura: valida la entrada y llama a `rpc` (la función property_call de Supabase).

export type PropertyRpc = (action: string, args: Record<string, unknown>) => Promise<Record<string, unknown>>;

export const PROPERTY_SERVER_INFO = { name: "inmuebles-dashboard", version: "1.0.0" };

export const PROPERTY_INSTRUCTIONS =
  "Radar de inversión inmobiliaria de Raúl. Empieza con get_search_context (criterios y anuncios ya vistos). " +
  "Guarda cada anuncio con save_listing: solo datos reales y verificables, nunca cálculos de rentabilidad, " +
  "cuotas ni puntuaciones (los hace el dashboard). Marca con mark_removed los anuncios conocidos que ya no " +
  "estén publicados y termina con save_run_summary.";

const inputJsonSchema = (schema: z.ZodType) => {
  const json = z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }) as Record<string, unknown>;
  delete json.$schema;
  return json;
};

export const PROPERTY_TOOLS = [
  {
    name: "get_search_context",
    description:
      "Devuelve los criterios de búsqueda (zonas por prioridad, rango de precio, capital propio máximo, " +
      "rentabilidad bruta objetivo, notas) y los anuncios ya guardados (URL, precio, estado). Llámala al " +
      "principio: no repitas anuncios conocidos salvo para actualizarlos (precio, si sigue activo).",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "save_listing",
    description:
      "Guarda o actualiza un anuncio (se identifica por su URL). Importes en euros: price y previous_price " +
      "totales; rent.* y rent_cap mensuales; community_fee mensual; ibi anual; market_price_sqm en €/m²; " +
      "reform_cost y furnishing_cost estimados para dejarlo listo para alquilar. rent_cap es la renta máxima " +
      "legal si la zona está tensionada (índice de referencia), no la anunciada. rent_comparables y " +
      "sale_comparables: anuncios reales con su enlace. scores (0–10): demand = facilidad de alquilar, " +
      "appreciation = revalorización, safety = seguridad jurídica, técnica y de liquidez. provenance marca " +
      "cada dato como verificado, anunciante o estimado. target_price solo si hay evidencia para negociar " +
      "(negotiation_evidence). pending: lo que falta validar. No inventes datos: si no lo sabes, omítelo.",
    inputSchema: inputJsonSchema(listingInputSchema),
  },
  {
    name: "mark_removed",
    description: "Marca como retirado un anuncio ya guardado que ya no está publicado o se ha vendido.",
    inputSchema: inputJsonSchema(removedInputSchema),
  },
  {
    name: "save_run_summary",
    description:
      "Al terminar: cuántos anuncios has examinado, cuántos has guardado y un resumen corto (2–3 frases) " +
      "de la búsqueda de hoy (fuentes consultadas, si no hubo suficientes resultados…).",
    inputSchema: inputJsonSchema(runInputSchema),
  },
] as const;

const invalid = (error: z.ZodError) => ({
  error: `Datos no válidos: ${error.issues
    .slice(0, 5)
    .map((i) => `${i.path.join(".") || "entrada"}: ${i.message}`)
    .join("; ")}`,
});

/** Contexto para la IA: criterios legibles y anuncios conocidos. */
function contextForAgent(raw: Record<string, unknown>) {
  const settings = (raw.settings ?? {}) as { criteria?: unknown };
  const c = criteriaSchema.catch(criteriaSchema.parse({})).parse(settings.criteria ?? {});
  return {
    criteria: {
      zones_by_priority: parseZones(c.zones),
      price_range_eur: [c.price_min_eur, c.price_max_eur],
      price_exceptional_max_eur: c.price_exceptional_eur,
      max_equity_eur: c.max_equity_eur,
      gross_yield_pct: { minimum: c.gross_min_pct, target: c.gross_target_pct },
      notes: c.notes,
    },
    known_listings: raw.known ?? [],
    last_runs: raw.last_runs ?? [],
  };
}

export function propertyServer(rpc: PropertyRpc): McpServer {
  return {
    info: PROPERTY_SERVER_INFO,
    instructions: PROPERTY_INSTRUCTIONS,
    tools: PROPERTY_TOOLS,
    async call(name, args) {
      switch (name) {
        case "get_search_context": {
          const raw = await rpc("context", {});
          return typeof raw.error === "string" ? raw : contextForAgent(raw);
        }
        case "save_listing": {
          const parsed = listingInputSchema.safeParse(args);
          if (!parsed.success) return invalid(parsed.error);
          const l = parsed.data;
          const price = Math.round(l.price * 100);
          const previous = l.previous_price != null ? Math.round(l.previous_price * 100) : undefined;
          return rpc("save_listing", {
            url: l.url,
            source: l.source ?? safeHost(l.url),
            title: l.title,
            municipality: l.municipality,
            neighborhood: l.neighborhood,
            price_cents: price,
            first_price_cents: previous && previous > 0 ? previous : undefined,
            sqm: l.sqm,
            rooms: l.rooms,
            confidence: l.confidence,
            listing_state: l.listing_state,
            data: toListingData(l),
          });
        }
        case "mark_removed": {
          const parsed = removedInputSchema.safeParse(args);
          return parsed.success ? rpc("mark_removed", parsed.data) : invalid(parsed.error);
        }
        case "save_run_summary": {
          const parsed = runInputSchema.safeParse(args);
          return parsed.success ? rpc("save_run", parsed.data) : invalid(parsed.error);
        }
        default:
          return { error: "Herramienta desconocida" };
      }
    },
  };
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
