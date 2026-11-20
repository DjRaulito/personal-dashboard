import { describe, expect, it, vi } from "vitest";
import { taskServer } from "./mcp";

describe("tareas · conector", () => {
  it("registra, valida los resultados contra los campos y guarda", async () => {
    const rpc = vi.fn(async (action: string) =>
      action === "context" ? { task: { fields: [{ key: "price", label: "Precio", type: "money" }] } } : { ok: true },
    );
    const server = taskServer(rpc);
    expect(await server.call("register_task", { task: "Mal Nombre", name: "x" })).toHaveProperty("error");
    await server.call("register_task", { task: "radar-trabajo", name: "Radar de trabajo" });
    expect(rpc).toHaveBeenCalledWith("register_task", expect.objectContaining({ task: "radar-trabajo", fields: [] }));

    expect(await server.call("save_item", { task: "radar-trabajo", key: "a", data: { otro: 1 } })).toHaveProperty(
      "error",
    );
    await server.call("save_item", { task: "radar-trabajo", key: "b", data: { price: "1200", otro: 1 } });
    expect(rpc).toHaveBeenCalledWith("save_item", { task: "radar-trabajo", key: "b", data: { price: 1200 } });
    // El contexto (campos) se pide una sola vez
    expect(rpc.mock.calls.filter(([a]) => a === "context")).toHaveLength(1);
  });

  it("propaga el error si la tarea no existe", async () => {
    const server = taskServer(async () => ({ error: "Esa tarea no existe" }));
    expect(await server.call("save_item", { task: "nada", key: "a", data: { x: 1 } })).toEqual({
      error: "Esa tarea no existe",
    });
  });
});
