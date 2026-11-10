import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { pickBest, pixabayClip, pexelsClip } = await import("./stock");

describe("pickBest", () => {
  it("elige el archivo más ligero que cubra 1080 en el lado corto", () => {
    const files = [
      { url: "a", width: 3840, height: 2160 },
      { url: "b", width: 1920, height: 1080 },
      { url: "c", width: 1280, height: 720 },
    ];
    expect(pickBest(files)?.url).toBe("b");
  });

  it("si ninguno llega, el más grande; descarta los vacíos", () => {
    expect(
      pickBest([
        { url: "", width: 1920, height: 1080 },
        { url: "c", width: 1280, height: 720 },
        { url: "d", width: 640, height: 360 },
      ])?.url,
    ).toBe("c");
    expect(pickBest([])).toBeNull();
  });
});

describe("pixabayClip", () => {
  it("convierte un resultado de Pixabay en clip con su fuente", () => {
    const clip = pixabayClip({
      id: 1,
      pageURL: "https://pixabay.com/videos/id-1/",
      duration: 12,
      videos: {
        large: { url: "", width: 0, height: 0 },
        medium: { url: "https://cdn.pixabay.com/m.mp4", width: 1920, height: 1080 },
        small: { url: "https://cdn.pixabay.com/s.mp4", width: 1280, height: 720 },
      },
    });
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
    const clip = pexelsClip({
      id: 2,
      url: "https://www.pexels.com/video/2/",
      duration: 8,
      video_files: [
        { link: "x.webm", width: 1080, height: 1920, file_type: "video/webm" },
        { link: "y.mp4", width: 720, height: 1280, file_type: "video/mp4" },
      ],
    });
    expect(clip?.url).toBe("y.mp4");
    expect(clip?.source).toBe("Pexels");
  });
});
