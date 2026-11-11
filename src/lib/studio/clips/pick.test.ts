import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const askJson = vi.fn();
vi.mock("@/lib/ai/llm", () => ({ aiConfigured: () => true, askJson: (...args: unknown[]) => askJson(...args) }));

const { applyPicks, chooseClips, firstCandidates } = await import("./pick");

const cand = (id: string) => ({
  id,
  url: `${id}.mp4`,
  width: 1080,
  height: 1920,
  duration: 6,
  tags: id,
  thumb: `${id}.jpg`,
});

const scenes = [
  { text: "Llevas meses en el gimnasio sin cambios", count: 2, candidates: [cand("a"), cand("b"), cand("c")] },
  { text: "Duerme más", count: 1, candidates: [cand("b"), cand("d")] },
];

afterEach(() => {
  askJson.mockReset();
  vi.unstubAllGlobals();
});

describe("firstCandidates", () => {
  it("toma los primeros sin repetir clip entre escenas", () => {
    expect(firstCandidates(scenes).map((s) => s.map((c) => c.url))).toEqual([["a.mp4", "b.mp4"], ["d.mp4"]]);
  });
});

describe("applyPicks", () => {
  it("respeta el orden de la IA, el número de planos y no repite", () => {
    const clips = applyPicks(scenes, [
      [2, 0, 1],
      [0, 1],
    ]);
    expect(clips.map((s) => s.map((c) => c.url))).toEqual([["c.mp4", "a.mp4"], ["b.mp4"]]);
  });

  it("lista vacía deja la escena sin clips; sin respuesta usa los primeros", () => {
    const clips = applyPicks(scenes, [[], undefined]);
    expect(clips.map((s) => s.length)).toEqual([0, 1]);
    expect(clips[1][0].url).toBe("b.mp4");
  });

  it("ignora índices inexistentes", () => {
    expect(applyPicks(scenes, [[9, 1], [5]]).map((s) => s.map((c) => c.url))).toEqual([["b.mp4"], []]);
  });
});

describe("chooseClips", () => {
  const thumbs = () =>
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/jpeg" } })),
    );

  it("traduce los números de imagen de la IA a candidatos de cada escena", async () => {
    thumbs();
    // Imágenes 1-3 son de la escena 1 (a, b, c) y 4-5 de la escena 2 (b, d)
    askJson.mockResolvedValue({
      scenes: [
        { scene: 1, picks: [3, 4] },
        { scene: 2, picks: [5] },
      ],
    });
    const { clips, ai } = await chooseClips("Gimnasio", scenes);
    expect(ai).toBe(true);
    // La 4 no es de la escena 1: se ignora
    expect(clips.map((s) => s.map((c) => c.url))).toEqual([["c.mp4"], ["d.mp4"]]);
    const [, , prompt, images] = askJson.mock.calls[0];
    expect(images).toHaveLength(5);
    expect(prompt).toContain("Escena 1 (elige hasta 2)");
    expect(prompt).toContain("imagen 5");
  });

  it("si la IA falla, usa los primeros candidatos", async () => {
    thumbs();
    askJson.mockRejectedValue(new Error("cuota"));
    const { clips, ai } = await chooseClips("Gimnasio", scenes);
    expect(ai).toBe(false);
    expect(clips).toEqual(firstCandidates(scenes));
  });
});
