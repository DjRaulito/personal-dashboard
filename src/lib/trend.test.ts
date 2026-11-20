import { describe, expect, it } from "vitest";
import { trendClass } from "./trend";

describe("subidas y bajadas", () => {
  it("lleva flecha y color según el signo, y gris si no hay cambio", () => {
    expect(trendClass(0.12)).toBe("trend-up text-up");
    expect(trendClass(-3)).toBe("trend-down text-down");
    expect(trendClass(0)).toBe("text-muted");
    expect(trendClass(null)).toBe("text-muted");
    expect(trendClass(Number.NaN)).toBe("text-muted");
  });
});
