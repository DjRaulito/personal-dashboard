import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "./schemas";
import { evaluateListings, filterListings, parseFilters, summarize, toListing, type ListingRecord } from "./view";

const NOW = new Date("2026-11-16T10:00:00Z");

function record(overrides: Partial<ListingRecord> = {}): ListingRecord {
  return {
    id: "a",
    url: "https://example.com/1",
    source: "example.com",
    title: "Piso",
    municipality: "Zona A",
    neighborhood: "",
    price_cents: 12_000_000,
    first_price_cents: 12_000_000,
    sqm: 70,
    rooms: 3,
    confidence: "media",
    listing_state: "activo",
    status: "nuevo",
    data: { rent: { base: 100_000 } },
    user_notes: "",
    discard_reason: "",
    first_seen_at: "2026-11-16T07:00:00Z",
    last_checked_at: "2026-11-16T07:00:00Z",
    removed_at: null,
    ...overrides,
  };
}

describe("lista de inmuebles", () => {
  const rows = [
    record({ id: "bueno" }),
    record({ id: "caro", price_cents: 22_000_000, municipality: "Zona B", first_seen_at: "2026-11-01T07:00:00Z" }),
    record({ id: "sin-renta", data: {} }),
    record({ id: "descartado", status: "descartado" }),
    record({ id: "retirado", listing_state: "retirado" }),
  ].map(toListing);
  const history = new Map([
    [
      "caro",
      [
        { price: 23_000_000, seen_at: "2026-11-01T07:00:00Z" },
        { price: 22_000_000, seen_at: "2026-11-10T07:00:00Z" },
      ],
    ],
  ]);
  const list = evaluateListings(rows, history, DEFAULT_SETTINGS, NOW);

  it("ordena por puntuación y deja descartados y retirados al final", () => {
    expect(list.slice(-2).map((l) => l.id)).toEqual(["retirado", "descartado"]);
    expect(list[0].id).toBe("bueno");
  });

  it("resume el día", () => {
    const s = summarize(list, [{ ran_at: NOW.toISOString(), examined: 30, saved: 5, summary: "" }]);
    expect(s.active).toBe(3);
    expect(s.newToday).toBe(2);
    expect(s.priceDrops).toBe(1);
    expect(s.meeting).toBe(1);
    expect(s.best?.id).toBe("bueno");
    expect(s.lastRun?.examined).toBe(30);
  });

  it("filtra por estado, municipio y criterios", () => {
    expect(filterListings(list, parseFilters({})).map((l) => l.id)).toEqual(
      expect.arrayContaining(["bueno", "caro", "sin-renta"]),
    );
    expect(filterListings(list, parseFilters({ estado: "todos" }))).toHaveLength(5);
    expect(filterListings(list, parseFilters({ municipio: "Zona B" })).map((l) => l.id)).toEqual(["caro"]);
    expect(filterListings(list, parseFilters({ cumple: "1" })).map((l) => l.id)).toEqual(["bueno"]);
    expect(parseFilters({ estado: "raro" }).status).toBe("activos");
  });

  it("tolera datos viejos o rotos", () => {
    const l = toListing(record({ data: "basura", confidence: "?", status: "?" }));
    expect(l.data.rent).toEqual({});
    expect(l.confidence).toBe("media");
    expect(l.status).toBe("nuevo");
  });
});
