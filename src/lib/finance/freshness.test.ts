import { describe, expect, it } from "vitest";
import { freshness } from "./freshness";

describe("datos al día", () => {
  it("dice cuándo son los datos y avisa a partir de 4 días", () => {
    expect(freshness("2026-11-20", "2026-11-20")).toEqual({ label: "al día (hoy)", stale: false });
    expect(freshness("2026-11-19", "2026-11-20")).toEqual({ label: "de ayer", stale: false });
    expect(freshness("2026-11-17", "2026-11-20")).toEqual({ label: "de hace 3 días", stale: false });
    expect(freshness("2026-11-16", "2026-11-20")).toEqual({ label: "de hace 4 días", stale: true });
    expect(freshness(null, "2026-11-20").stale).toBe(true);
  });
});
