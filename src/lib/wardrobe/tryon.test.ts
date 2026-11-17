import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { queueMessages, resultUrl, tryOnFailure } = await import("./tryon");

const SPACE = "https://franciszzj-leffa.hf.space";

describe("probador virtual · cola de Gradio", () => {
  it("lee los mensajes de la cola e ignora líneas que no son JSON", () => {
    const stream = [
      'data: {"msg":"estimation","rank":0}',
      "",
      "data: {roto",
      ": comentario",
      'data: {"msg":"process_starts"}',
      "",
      'data: {"msg":"process_completed","success":true,"output":{"data":[{"path":"/tmp/gradio/a/image.webp"}]}}',
    ].join("\n");
    expect(queueMessages(stream).map((m) => m.msg)).toEqual(["estimation", "process_starts", "process_completed"]);
  });

  it("saca la imagen del propio Space y rechaza URLs de fuera", () => {
    expect(
      resultUrl({ msg: "process_completed", output: { data: [{ path: "/tmp/gradio/a/image.webp" }] } }, SPACE),
    ).toBe(`${SPACE}/gradio_api/file=/tmp/gradio/a/image.webp`);
    expect(
      resultUrl({ msg: "process_completed", output: { data: [{ url: `${SPACE}/gradio_api/file=x.webp` }] } }, SPACE),
    ).toBe(`${SPACE}/gradio_api/file=x.webp`);
    expect(
      resultUrl({ msg: "process_completed", output: { data: [{ url: "https://otro.example/x.webp" }] } }, SPACE),
    ).toBeNull();
    expect(resultUrl({ msg: "process_completed", output: { data: [] } }, SPACE)).toBeNull();
  });

  it("traduce los fallos: cupo agotado, saturado y genérico", () => {
    const quota = tryOnFailure({
      msg: "process_completed",
      success: false,
      title: "ZeroGPU quota exceeded",
      output: { error: "You have exceeded your ZeroGPU runs limit." },
    });
    expect(quota.quota).toBe(true);
    expect(quota.message).toContain("cupo gratuito");
    expect(tryOnFailure({ msg: "queue_full" }).message).toContain("saturado");
    const generic = tryOnFailure(null);
    expect(generic.quota).toBe(false);
    expect(generic.message).toContain("cuerpo entero");
  });
});
