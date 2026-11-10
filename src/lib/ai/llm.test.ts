import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { geminiCandidates, openRouterCandidates } = await import("./llm");

describe("geminiCandidates", () => {
  it("ordena los Flash estables de más nuevo a más viejo y descarta variantes", () => {
    expect(
      geminiCandidates([
        "models/gemini-2.5-flash",
        "models/gemini-3.8-flash-preview",
        "models/gemini-3.5-flash",
        "models/gemini-3.5-flash-lite",
        "models/gemini-3.5-flash-image",
      ]),
    ).toEqual(["gemini-3.5-flash", "gemini-2.5-flash", "gemini-3.8-flash-preview"]);
  });
});

describe("openRouterCandidates", () => {
  const free = { prompt: "0", completion: "0" };
  const models = [
    { id: "a/small:free", pricing: free, supported_parameters: ["tools"], context_length: 8000 },
    { id: "b/big:free", pricing: free, supported_parameters: ["tools"], context_length: 128000 },
    { id: "c/paid", pricing: { prompt: "0.000001", completion: "0.000002" }, supported_parameters: ["tools"] },
    { id: "d/notools:free", pricing: free, supported_parameters: ["temperature"] },
    {
      id: "e/vision:free",
      pricing: free,
      supported_parameters: [],
      architecture: { input_modalities: ["text", "image"] },
    },
  ];

  it("elige solo modelos gratis con herramientas, los de más contexto primero", () => {
    expect(openRouterCandidates(models, false)).toEqual(["b/big:free", "a/small:free"]);
  });

  it("para fotos elige los gratis que ven imágenes", () => {
    expect(openRouterCandidates(models, true)).toEqual(["e/vision:free"]);
  });
});
