import { describe, expect, it } from "vitest";
import {
  engagementRate,
  latestTotalsByPiece,
  pieceFormSchema,
  positionBetween,
  splitList,
  sumTotals,
  type MetricRow,
} from "./catalog";

describe("splitList", () => {
  it("separa por comas, punto y coma y saltos de línea sin repetidos", () => {
    expect(splitList("gym, Gym; finanzas\n  \nIA", 8, 30)).toEqual(["gym", "finanzas", "IA"]);
  });
  it("respeta el máximo y recorta cada valor", () => {
    expect(splitList("a,b,c,d", 2, 30)).toEqual(["a", "b"]);
    expect(splitList("abcdef", 5, 3)).toEqual(["abc"]);
  });
});

describe("pieceFormSchema", () => {
  it("normaliza vacíos a null y separa etiquetas y enlaces", () => {
    const parsed = pieceFormSchema.parse({
      title: "  Rutina de pierna  ",
      tags: "gym, piernas",
      links: "https://a.com https://b.com",
      script: "",
      publish_at: "2026-11-20T18:30",
    });
    expect(parsed.title).toBe("Rutina de pierna");
    expect(parsed.tags).toEqual(["gym", "piernas"]);
    expect(parsed.links).toEqual(["https://a.com", "https://b.com"]);
    expect(parsed.script).toBeNull();
    expect(parsed.publish_at).toBe("2026-11-20T18:30");
    expect(parsed.status).toBe("idea");
  });
  it("rechaza enlaces sin http", () => {
    expect(pieceFormSchema.safeParse({ title: "x", links: "ftp://a" }).success).toBe(false);
  });
});

describe("positionBetween", () => {
  it("calcula huecos entre vecinas", () => {
    expect(positionBetween(null, null)).toBe(1000);
    expect(positionBetween(null, 500)).toBe(-500);
    expect(positionBetween(2000, null)).toBe(3000);
    expect(positionBetween(1000, 2000)).toBe(1500);
  });
});

describe("métricas", () => {
  const base = { likes: 0, comments: 0, shares: 0, saves: 0, followers_gained: 0 };
  const rows: MetricRow[] = [
    { ...base, piece_id: "a", platform: "tiktok", recorded_on: "2026-11-01", views: 100 },
    { ...base, piece_id: "a", platform: "tiktok", recorded_on: "2026-11-05", views: 900, likes: 90 },
    { ...base, piece_id: "a", platform: "youtube", recorded_on: "2026-11-02", views: 50 },
    { ...base, piece_id: "b", platform: "instagram", recorded_on: "2026-11-03", views: 10, comments: 1 },
  ];

  it("usa la última foto por plataforma y suma plataformas", () => {
    const totals = latestTotalsByPiece(rows);
    expect(totals.get("a")?.views).toBe(950);
    expect(totals.get("a")?.likes).toBe(90);
    expect(totals.get("b")?.views).toBe(10);
    expect(sumTotals(totals.values()).views).toBe(960);
  });

  it("calcula la tasa de interacción y evita dividir por cero", () => {
    expect(engagementRate({ ...base, views: 200, likes: 10, comments: 10 })).toBeCloseTo(0.1);
    expect(engagementRate({ ...base, views: 0 })).toBeNull();
  });
});
