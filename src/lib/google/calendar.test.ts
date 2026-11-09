import { describe, expect, it } from "vitest";
import { groupByDay, normalizeEvents } from "./calendar";

const range = { start: new Date("2026-11-08T23:00:00Z"), end: new Date("2026-11-10T23:00:00Z") };

describe("normalizeEvents", () => {
  it("normaliza, descarta cancelados e inválidos y ordena", () => {
    const events = normalizeEvents({
      items: [
        {
          id: "b",
          summary: "Gimnasio",
          start: { dateTime: "2026-11-09T18:00:00+01:00" },
          end: { dateTime: "2026-11-09T19:00:00+01:00" },
        },
        { id: "a", start: { date: "2026-11-09" }, end: { date: "2026-11-10" } },
        {
          id: "c",
          status: "cancelled",
          summary: "X",
          start: { dateTime: "2026-11-09T10:00:00Z" },
          end: { dateTime: "2026-11-09T11:00:00Z" },
        },
        { nope: true },
      ],
    });
    expect(events.map((e) => e.id)).toEqual(["a", "b"]);
    expect(events[0]).toMatchObject({ title: "(Sin título)", allDay: true });
    expect(events[0].start.toISOString()).toBe("2026-11-08T23:00:00.000Z");
  });

  it("acepta respuestas sin items", () => {
    expect(normalizeEvents({})).toEqual([]);
  });
});

describe("groupByDay", () => {
  it("un evento de todo el día no se cuela en el día siguiente", () => {
    const events = normalizeEvents({
      items: [{ id: "a", start: { date: "2026-11-09" }, end: { date: "2026-11-10" } }],
    });
    expect(groupByDay(events, range).map((g) => g.key)).toEqual(["2026-11-09"]);
  });

  it("un evento de varios días aparece en cada día del rango", () => {
    const events = normalizeEvents({
      items: [{ id: "v", start: { date: "2026-11-08" }, end: { date: "2026-11-12" } }],
    });
    expect(groupByDay(events, range).map((g) => g.key)).toEqual(["2026-11-09", "2026-11-10"]);
  });
});
