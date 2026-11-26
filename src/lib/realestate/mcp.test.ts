import { describe, expect, it, vi } from "vitest";
import { handleJsonRpc } from "@/lib/mcp/jsonrpc";
import { PROPERTY_TOOLS, propertyServer } from "./mcp";

type Reply = { result: { content: { text: string }[]; isError: boolean; tools?: { name: string }[] } };

function setup(response: Record<string, unknown> = { id: "x", created: true }) {
  const rpc = vi.fn(async () => response);
  const server = propertyServer(rpc);
  const callTool = async (name: string, args: unknown) => {
    const reply = (await handleJsonRpc(
      { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } },
      server,
    )) as Reply;
    return { body: JSON.parse(reply.result.content[0].text), isError: reply.result.isError };
  };
  return { rpc, server, callTool };
}

describe("conector de inmuebles", () => {
  it("lista sus cuatro herramientas con esquemas JSON", async () => {
    const { server } = setup();
    const reply = (await handleJsonRpc({ jsonrpc: "2.0", id: 1, method: "tools/list" }, server)) as Reply;
    expect(reply.result.tools?.map((t) => t.name)).toEqual(PROPERTY_TOOLS.map((t) => t.name));
    const save = PROPERTY_TOOLS.find((t) => t.name === "save_listing")!;
    expect(save.inputSchema).toMatchObject({ type: "object", required: expect.arrayContaining(["url", "price"]) });
    expect(save.inputSchema).not.toHaveProperty("$schema");
  });

  it("convierte euros a céntimos y separa los datos del anuncio", async () => {
    const { rpc, callTool } = setup();
    const { isError } = await callTool("save_listing", {
      url: "https://www.portal.example/inmueble/123/?utm=x",
      municipality: "Municipio",
      price: 185_000.5,
      previous_price: 195_000,
      sqm: 82,
      rent: { base: 1_050 },
      reform_cost: 6_000,
      provenance: { price: "verificado", rent: "estimado" },
      risks: ["Bajo sin ascensor"],
    });
    expect(isError).toBe(false);
    expect(rpc).toHaveBeenCalledWith(
      "save_listing",
      expect.objectContaining({
        source: "portal.example",
        price_cents: 18_500_050,
        first_price_cents: 19_500_000,
        data: expect.objectContaining({
          rent: { base: 105_000, conservative: undefined, optimistic: undefined },
          reform_cost: 600_000,
          risks: ["Bajo sin ascensor"],
          condition: "desconocido",
        }),
      }),
    );
  });

  it("rechaza datos no válidos sin tocar la base", async () => {
    const { rpc, callTool } = setup();
    const { body, isError } = await callTool("save_listing", { url: "no-es-url", municipality: "", price: -3 });
    expect(isError).toBe(true);
    expect(body.error).toMatch(/Datos no válidos/);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("el contexto devuelve criterios legibles para la IA", async () => {
    const { callTool } = setup({
      settings: { criteria: { zones: "Zona A, Zona B", max_equity_eur: 40_000 } },
      known: [{ url: "https://a.example/1" }],
      last_runs: [],
    });
    const { body } = await callTool("get_search_context", {});
    expect(body.criteria.zones_by_priority).toEqual(["Zona A", "Zona B"]);
    expect(body.criteria.max_contribution_eur).toBe(40_000);
    expect(body.known_listings).toHaveLength(1);
  });

  it("pasa los errores del token tal cual", async () => {
    const { callTool } = setup({ error: "Token no válido" });
    const { body, isError } = await callTool("get_search_context", {});
    expect(isError).toBe(true);
    expect(body.error).toBe("Token no válido");
  });

  it("guarda el resumen de la ejecución", async () => {
    const { rpc, callTool } = setup({ id: "run" });
    await callTool("save_run_summary", { examined: 40, saved: 6, summary: "Pocas novedades." });
    expect(rpc).toHaveBeenCalledWith("save_run", { examined: 40, saved: 6, summary: "Pocas novedades." });
  });
});
