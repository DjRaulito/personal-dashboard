import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  pickBest,
  pixabayCandidate,
  pixabayClip,
  pexelsClip,
  queryAlternatives,
  rankCandidates,
  tagScore,
  toClip,
  upscale,
} = await import("./stock");

const hit = (extra: Record<string, unknown> = {}) => ({
  id: 7,
  pageURL: "https://pixabay.com/videos/id-7/",
  duration: 10,
  tags: "man, gym, workout",
  videos: {
    large: { url: "l.mp4", width: 3840, height: 2160, thumbnail: "l.jpg" },
    small: { url: "s.mp4", width: 1280, height: 720, thumbnail: "s.jpg" },
  },
  ...extra,
});

describe("tagScore", () => {
  it("cuenta las palabras de la búsqueda que están en las etiquetas, por raíz", () => {
    expect(tagScore("man lifting barbell", "man, lift, barbells, gym")).toBe(1);
    expect(tagScore("man sleeping", "woman, bed, sleep")).toBe(0.5);
    expect(tagScore("frustrated man gym", "tennis, court, ball")).toBe(0);
  });
});

describe("rankCandidates", () => {
  const c = (id: string, width: number, height: number, tags: string) =>
    ({ id, url: id, width, height, duration: 5, tags }) as const;

  it("manda que encajen las etiquetas; a igualdad, la orientación del vídeo", () => {
    const ranked = rankCandidates(
      [
        c("h-match", 1920, 1080, "man sleeping"),
        c("v-other", 1080, 1920, "wall"),
        c("v-match", 1080, 1920, "sleeping man bed"),
      ],
      "man sleeping",
      "short",
    );
    expect(ranked.map((x) => x.id)).toEqual(["v-match", "h-match", "v-other"]);
  });
});

describe("pixabayCandidate", () => {
  it("lleva id, miniatura y etiquetas; toClip los quita", () => {
    const candidate = pixabayCandidate(hit(), "long");
    expect(candidate).toMatchObject({ id: "pixabay:7", thumb: "s.jpg", tags: "man, gym, workout", url: "l.mp4" });
    expect(toClip(candidate!)).toEqual({
      url: "l.mp4",
      width: 3840,
      height: 2160,
      duration: 10,
      page: "https://pixabay.com/videos/id-7/",
      source: "Pixabay",
    });
  });

  it("descarta los vídeos hechos con IA y los de baja calidad", () => {
    expect(pixabayCandidate(hit({ isAiGenerated: true }), "long")).toBeNull();
    expect(pixabayCandidate(hit({ isLowQuality: true }), "long")).toBeNull();
  });
});

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
        tags: "",
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
