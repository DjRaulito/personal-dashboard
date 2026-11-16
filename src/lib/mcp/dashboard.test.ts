import { describe, expect, it, vi } from "vitest";
import { handleJsonRpc } from "./jsonrpc";
import { dashboardServer } from "./dashboard";

describe("conector único del dashboard", () => {
  const brain = vi.fn(async () => ({ memories: [] }) as Record<string, unknown>);
  const property = vi.fn(async () => ({ known: [], settings: {}, last_runs: [] }) as Record<string, unknown>);
  const server = dashboardServer(brain, property);
  const call = (name: string, args: unknown = {}) =>
    handleJsonRpc({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }, server);

  it("ofrece las herramientas del cerebro y las de inmuebles", async () => {
    const reply = (await handleJsonRpc({ jsonrpc: "2.0", id: 1, method: "tools/list" }, server)) as {
      result: { tools: { name: string }[] };
    };
    const names = reply.result.tools.map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(["remember", "search", "get_search_context", "save_listing"]));
    expect(new Set(names).size).toBe(names.length);
  });

  it("envía cada herramienta a su sitio", async () => {
    await call("search", { query: "gym" });
    expect(brain).toHaveBeenCalledWith("search", { query: "gym" });
    await call("get_search_context");
    expect(property).toHaveBeenCalledWith("context", {});
  });
});
