import { describe, expect, it } from "vitest";
import { correlation, correlationLabel, foodSpendVsDiet, trainingVsRest, weightVsSets } from "./crosses";

describe("cruces", () => {
  it("agrupa series, entrenos y peso medio por semana", () => {
    const rows = weightVsSets(
      ["2026-11-02", "2026-11-09"],
      ["2026-11-03", "2026-11-05", "2026-11-10"],
      new Map([
        ["2026-11-03", 20],
        ["2026-11-05", 18],
        ["2026-11-10", 22],
      ]),
      [
        { day: "2026-11-02", kg: 80 },
        { day: "2026-11-08", kg: 79.5 },
      ],
    );
    expect(rows).toEqual([
      { week: "2026-11-02", workouts: 2, sets: 38, weightKg: 79.8 },
      { week: "2026-11-09", workouts: 1, sets: 22, weightKg: null },
    ]);
  });

  it("calcula la correlación", () => {
    expect(
      correlation([
        [1, 2],
        [2, 4],
        [3, 6],
        [4, 8],
      ]),
    ).toBeCloseTo(1);
    expect(
      correlation([
        [1, 2],
        [2, 4],
      ]),
    ).toBeNull();
    expect(correlationLabel(null)).toMatch(/datos suficientes/);
    expect(correlationLabel(-0.7)).toMatch(/clara negativa/);
  });

  it("compara días de entreno y de descanso", () => {
    const { training, rest } = trainingVsRest(
      ["2026-11-03", "2026-11-04", "2026-11-05"],
      new Set(["2026-11-03"]),
      [
        { day: "2026-11-03", status: "done" },
        { day: "2026-11-03", status: "done" },
        { day: "2026-11-04", status: "done" },
        { day: "2026-11-04", status: "skipped" },
      ],
      new Map([
        ["2026-11-03", 2400],
        ["2026-11-04", 2000],
      ]),
      ["2026-11-05"],
      2,
    );
    expect(training).toEqual({ days: 1, adherence: 1, avgKcal: 2400, loggedDays: 1, cheats: 0 });
    expect(rest).toEqual({ days: 2, adherence: 0.5, avgKcal: 2000, loggedDays: 1, cheats: 1 });
  });

  it("suma el gasto en comida por mes", () => {
    const [oct] = foodSpendVsDiet(
      ["2026-10"],
      [
        { day: "2026-10-02", cents: -2500, category: "Supermercado" },
        { day: "2026-10-09", cents: -1500, category: "Restaurantes" },
        { day: "2026-10-20", cents: -500, category: "Supermercado" },
      ],
      [{ day: "2026-10-02", status: "done" }],
      [],
    );
    expect(oct).toMatchObject({
      totalCents: 4500,
      adherence: 1,
      spentCents: { Supermercado: 3000, Restaurantes: 1500 },
    });
  });
});
