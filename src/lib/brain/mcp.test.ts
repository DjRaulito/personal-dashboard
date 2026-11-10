import { describe, expect, it, vi } from "vitest";
import { BRAIN_TOOLS, extractToken, handleMcp } from "./mcp";
import { hashToken, memoryFormSchema, newToken, parseTags } from "./schemas";

describe("servidor MCP", () => {
  const call = vi.fn(async () => ({ memories: [] }) as Record<string, unknown>);

  it("responde a initialize con las herramientas activadas", async () => {
    const res = (await handleMcp(
      { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } },
      call,
    )) as {
      result: { protocolVersion: string; capabilities: object };
    };
    expect(res.result.protocolVersion).toBe("2025-06-18");
    expect(res.result.capabilities).toHaveProperty("tools");
  });

  it("las notificaciones no tienen respuesta", async () => {
    expect(await handleMcp({ jsonrpc: "2.0", method: "notifications/initialized" }, call)).toBeNull();
  });

  it("lista las siete herramientas", async () => {
    const res = (await handleMcp({ jsonrpc: "2.0", id: 2, method: "tools/list" }, call)) as {
      result: { tools: unknown[] };
    };
    expect(res.result.tools).toHaveLength(BRAIN_TOOLS.length);
    expect(BRAIN_TOOLS.map((t) => t.name)).toContain("forget_all");
  });

  it("ejecuta una herramienta y devuelve su resultado como texto", async () => {
    const res = (await handleMcp(
      { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "search", arguments: { query: "gym" } } },
      call,
    )) as { result: { content: { text: string }[]; isError: boolean } };
    expect(call).toHaveBeenCalledWith("search", { query: "gym" });
    expect(JSON.parse(res.result.content[0].text)).toEqual({ memories: [] });
    expect(res.result.isError).toBe(false);
  });

  it("marca isError cuando la base devuelve un error", async () => {
    const bad = async () => ({ error: "Token no válido" });
    const res = (await handleMcp({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "list" } }, bad)) as {
      result: { isError: boolean };
    };
    expect(res.result.isError).toBe(true);
  });

  it("rechaza herramientas y métodos desconocidos", async () => {
    const tool = (await handleMcp(
      { jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "drop_tables" } },
      call,
    )) as {
      error: { code: number };
    };
    expect(tool.error.code).toBe(-32602);
    const method = (await handleMcp({ jsonrpc: "2.0", id: 6, method: "resources/list" }, call)) as {
      error: { code: number };
    };
    expect(method.error.code).toBe(-32601);
    expect(await handleMcp("hola", call)).toMatchObject({ error: { code: -32600 } });
  });
});

describe("formulario y tokens", () => {
  it("normaliza etiquetas", () => {
    expect(parseTags("Gym, rutina,  gym\nDieta")).toEqual(["gym", "rutina", "dieta"]);
    expect(parseTags("a,b,c,d,e,f,g,h,i,j")).toHaveLength(8);
  });

  it("valida el recuerdo", () => {
    const ok = memoryFormSchema.safeParse({ title: " Gym ", content: "Push pull legs", tags: "Gym, rutina" });
    expect(ok.success && ok.data).toMatchObject({ title: "Gym", tags: ["gym", "rutina"] });
    expect(memoryFormSchema.safeParse({ title: "", content: "x", tags: "" }).success).toBe(false);
    expect(memoryFormSchema.safeParse({ title: "x", content: "y".repeat(2001), tags: "" }).success).toBe(false);
  });

  it("el token empieza por brain_ y su hash es el de SHA-256", () => {
    const { token, hash } = newToken();
    expect(token.startsWith("brain_")).toBe(true);
    expect(hash).toBe(hashToken(token));
    expect(hash).toHaveLength(64);
    expect(newToken().token).not.toBe(token);
  });
});

describe("token de la petición", () => {
  it("acepta la cabecera Bearer o ?token= en la dirección", () => {
    expect(extractToken("Bearer brain_abc", "https://x.app/api/brain/mcp")).toBe("brain_abc");
    expect(extractToken(null, "https://x.app/api/brain/mcp?token=brain_abc-_1")).toBe("brain_abc-_1");
    expect(extractToken(null, "https://x.app/api/brain/mcp?token=otra")).toBeNull();
    expect(extractToken(null, "https://x.app/api/brain/mcp")).toBeNull();
  });
});
