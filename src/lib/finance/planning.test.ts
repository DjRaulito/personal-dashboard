import { describe, expect, it } from "vitest";
import {
  addMonths,
  advanceDue,
  budgetStatus,
  detectRecurring,
  findPayment,
  goalProgress,
  merchantKey,
  monthElapsed,
  monthlyEquivalent,
  upcomingOccurrences,
} from "./planning";

describe("fechas", () => {
  it("suma meses sin desbordar el fin de mes", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonths("2026-11-15", 3)).toBe("2027-02-15");
  });

  it("avanza según la frecuencia", () => {
    expect(advanceDue("2026-11-09", "weekly")).toBe("2026-11-16");
    expect(advanceDue("2026-11-09", "quarterly")).toBe("2027-02-09");
    expect(advanceDue("2026-11-09", "yearly")).toBe("2027-11-09");
  });
});

describe("recurrentes", () => {
  it("calcula el equivalente mensual", () => {
    expect(monthlyEquivalent(-1200, "yearly")).toBe(-100);
    expect(monthlyEquivalent(-3000, "quarterly")).toBe(-1000);
    expect(monthlyEquivalent(-1200, "weekly")).toBe(-5200);
  });

  it("lista vencimientos en el rango y el vencido sin marcar", () => {
    const items = [
      {
        id: "a",
        name: "Gimnasio",
        amount_cents: -3000,
        frequency: "monthly" as const,
        next_due: "2026-11-01",
        active: true,
      },
      {
        id: "b",
        name: "Spotify",
        amount_cents: -1099,
        frequency: "weekly" as const,
        next_due: "2026-11-12",
        active: true,
      },
      {
        id: "c",
        name: "Baja",
        amount_cents: -500,
        frequency: "monthly" as const,
        next_due: "2026-11-12",
        active: false,
      },
    ];
    const out = upcomingOccurrences(items, "2026-11-09", "2026-11-30");
    expect(out.map((o) => `${o.item.id}:${o.date}`)).toEqual([
      "a:2026-11-01",
      "b:2026-11-12",
      "b:2026-11-19",
      "b:2026-11-26",
    ]);
  });

  it("reconoce el cargo en los movimientos", () => {
    const txs = [
      { booked_on: "2026-11-03", description: "RECIBO NETFLIX.COM 1234", amount_cents: -1399 },
      { booked_on: "2026-11-03", description: "Bizum", amount_cents: -1399 },
    ];
    expect(findPayment("netflix", -1299, "2026-11-01", "monthly", txs)?.description).toContain("NETFLIX");
    expect(findPayment("netflix", -1299, "2026-12-01", "monthly", txs)).toBeNull();
    expect(findPayment("netflix", 1299, "2026-11-01", "monthly", txs)).toBeNull();
    expect(findPayment(null, -1299, "2026-11-01", "monthly", txs)).toBeNull();
  });

  it("agrupa conceptos sin números", () => {
    expect(merchantKey("COMPRA TARJ. 5402XXXX SPOTIFY P1F3A STOCKHOLM")).toBe("COMPRA TARJ XXXX SPOTIFY");
    expect(merchantKey("Recibo Gimnasio Basic-Fit 11/2026")).toBe("RECIBO GIMNASIO BASIC FIT");
  });

  it("detecta suscripciones mensuales y descarta gastos sueltos", () => {
    const txs = [
      ...["2026-07-05", "2026-08-05", "2026-09-04", "2026-10-06", "2026-11-05"].map((d) => ({
        booked_on: d,
        description: `RECIBO GIMNASIO ${d.slice(5, 7)}`,
        amount_cents: -3990,
        category_id: "cat",
        account_id: "acc",
      })),
      ...["2026-07-02", "2026-07-20", "2026-09-30", "2026-10-01"].map((d) => ({
        booked_on: d,
        description: "MERCADONA",
        amount_cents: -4500,
      })),
      // Ya no se cobra: último cargo hace muchos meses
      ...["2026-01-10", "2026-02-10", "2026-03-10"].map((d) => ({
        booked_on: d,
        description: "HBO MAX",
        amount_cents: -999,
      })),
    ];
    const out = detectRecurring(txs, "2026-11-09");
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      name: "Recibo Gimnasio",
      amount_cents: -3990,
      frequency: "monthly",
      next_due: "2026-12-05",
      occurrences: 5,
      category_id: "cat",
      account_id: "acc",
    });
  });
});

describe("presupuestos", () => {
  it("avisa si el gasto va por delante del ritmo del mes", () => {
    expect(budgetStatus(10000, 3000, 0.5).state).toBe("ok");
    expect(budgetStatus(10000, 7000, 0.5).state).toBe("warn");
    expect(budgetStatus(10000, 9000, 0.95).state).toBe("warn");
    expect(budgetStatus(10000, 10500, 0.6)).toMatchObject({ state: "over", remaining: -500, projected: 17500 });
  });

  it("calcula la fracción del mes transcurrida", () => {
    expect(monthElapsed("2026-11-15", "2026-11")).toBe(0.5);
    expect(monthElapsed("2026-11-15", "2026-10")).toBe(1);
    expect(monthElapsed("2026-11-15", "2026-12")).toBe(0);
  });
});

describe("huchas", () => {
  it("calcula lo que falta y la aportación mensual", () => {
    const g = goalProgress(600000, 150000, "2027-11-09", "2026-11-09");
    expect(g.ratio).toBe(0.25);
    expect(g.missing).toBe(450000);
    expect(g.perMonth).toBeGreaterThan(36900);
    expect(g.perMonth).toBeLessThan(37600);
    expect(goalProgress(1000, 2000, null, "2026-11-09")).toMatchObject({ ratio: 1, done: true, perMonth: null });
  });
});
