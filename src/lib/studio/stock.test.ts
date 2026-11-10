import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { pickBest, pixabayClip, pexelsClip, queryAlternatives, upscale } = await import("./stock");

describe("pickBest", () => {
  const files = [
    { url: "4k", width: 3840, height: 2160 },
    { url: "hd", width: 1920, height: 1080 },
    { url: "720", width: 1280, height: 720 },
  ];

  it("en horizontal, el más ligero que cubre 1920×1080", () => {
    expect(pickBest(files, "long")?.url).toBe("hd");
  });

  it("en vertical, un clip horizontal necesita el 4K para no verse borroso", () => {
    expect(pickBest(files, "short")?.url).toBe("4k");
    expect(upscale({ url: "", width: 1920, height: 1080 }, "short")).toBeCloseTo(1.78, 2);
  });

  it("si ninguno llega, el más nítido; descarta los vacíos", () => {
    expect(
      pickBest(
        [
          { url: "", width: 3840, height: 2160 },
          { url: "c", width: 1280, height: 720 },
          { url: "d", width: 640, height: 360 },
        ],
        "long",
      )?.url,
    ).toBe("c");
    expect(pickBest([], "long")).toBeNull();
  });
});

describe("queryAlternatives", () => {
  it("separa las búsquedas de la IA y quita repetidas", () => {
    expect(queryAlternatives("man lifting barbell | gym workout | gym | gym")).toEqual([
      "man lifting barbell",
      "gym workout",
      "gym",
    ]);
    expect(queryAlternatives("ocean waves")).toEqual(["ocean waves"]);
  });
});

describe("pixabayClip", () => {
  it("convierte un resultado de Pixabay en clip con su fuente", () => {
    const clip = pixabayClip(
      {
        id: 1,
        pageURL: "https://pixabay.com/videos/id-1/",
        duration: 12,
        videos: {
          large: { url: "", width: 0, height: 0 },
          medium: { url: "https://cdn.pixabay.com/m.mp4", width: 1920, height: 1080 },
          small: { url: "https://cdn.pixabay.com/s.mp4", width: 1280, height: 720 },
        },
      },
      "long",
    );
    expect(clip).toEqual({
      url: "https://cdn.pixabay.com/m.mp4",
      width: 1920,
      height: 1080,
      duration: 12,
      page: "https://pixabay.com/videos/id-1/",
      source: "Pixabay",
    });
  });
});

describe("pexelsClip", () => {
  it("ignora archivos que no son mp4", () => {
    const clip = pexelsClip(
      {
        id: 2,
        url: "https://www.pexels.com/video/2/",
        duration: 8,
        video_files: [
          { link: "x.webm", width: 1080, height: 1920, file_type: "video/webm" },
          { link: "y.mp4", width: 720, height: 1280, file_type: "video/mp4" },
        ],
      },
      "short",
    );
    expect(clip?.url).toBe("y.mp4");
    expect(clip?.source).toBe("Pexels");
  });
});
