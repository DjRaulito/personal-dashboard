import { describe, expect, it } from "vitest";
import {
  analyze,
  appreciation,
  evaluate,
  firstYearInterest,
  maxPrice,
  monthlyPayment,
  priceChange,
  priceVsMarket,
  rentForGross,
  rentForRoi,
  scenarioRent,
  score,
  sensitivities,
  type ListingFacts,
} from "./engine";
import { assumptionsSchema, DEFAULT_SETTINGS, listingDataSchema, listingInputSchema, toListingData } from "./schemas";

const { criteria: C } = DEFAULT_SETTINGS;
// Supuestos fijos para que las cuentas del test no dependan de los valores por defecto
const A = assumptionsSchema.parse({
  purchase_costs_pct: 1.5,
  appraisal_eur: 400,
  interest_pct: 3.2,
  term_years: 30,
  vacancy_months: 1,
  home_insurance_eur: 250,
  community_default_eur: 60,
  ibi_default_eur: 350,
});

function facts(overrides: Record<string, unknown> = {}): ListingFacts {
  const input = listingInputSchema.parse({
    url: "https://example.com/anuncio/1",
    municipality: "Municipio",
    price: 180_000,
    sqm: 80,
    rent: { base: 1_100 },
    ...overrides,
  });
  return {
    price: Math.round(input.price * 100),
    sqm: input.sqm ?? null,
    data: listingDataSchema.parse(toListingData(input)),
  };
}

describe("cuota de la hipoteca", () => {
  it("coincide con la tabla francesa", () => {
    expect(monthlyPayment(100_000, 6, 30)).toBeCloseTo(599.55, 2);
    expect(monthlyPayment(100_000, 0, 10)).toBeCloseTo(833.33, 2);
    expect(monthlyPayment(0, 3, 30)).toBe(0);
  });
});

describe("rentas por escenario", () => {
  it("deduce las que faltan a partir de la base", () => {
    const f = facts();
    expect(scenarioRent(f.data, "base")).toBe(110_000);
    expect(scenarioRent(f.data, "conservative")).toBeCloseTo(99_000);
    expect(scenarioRent(f.data, "optimistic")).toBeCloseTo(121_000);
  });

  it("sin renta no hay análisis", () => {
    expect(analyze(facts({ rent: {} }), A)).toBeNull();
  });
});

describe("análisis de una operación", () => {
  const an = analyze(facts(), A)!;

  it("suma impuestos, gastos y capital propio", () => {
    expect(an.itp).toBeCloseTo(1_800_000);
    expect(an.purchaseCosts).toBeCloseTo(310_000); // 1,5 % + tasación
    expect(an.totalCost).toBeCloseTo(20_140_000);
    expect(an.loan).toBeCloseTo(14_400_000);
    expect(an.equity).toBeCloseTo(5_740_000);
  });

  it("calcula rentabilidades y cash flow", () => {
    expect(an.grossYield).toBeCloseTo(0.07333, 4);
    expect(an.opex.total).toBeCloseTo(360_800); // vacancia, comunidad, IBI, seguros, mantenimiento
    expect(an.noi).toBeCloseTo(959_200);
    expect(an.netYield).toBeCloseTo(959_200 / 20_140_000, 6);
    expect(an.payment).toBeCloseTo(monthlyPayment(14_400_000, 3.2, 30), 6);
    expect(an.cashflowYear).toBeCloseTo(959_200 - an.payment * 12, 6);
    expect(an.cashOnCash).toBeCloseTo(an.cashflowYear / an.equity, 6);
  });

  it("la renta nunca pasa del tope legal", () => {
    const capped = analyze(facts({ rent_cap: 1_000 }), A)!;
    expect(capped.rent).toBe(100_000);
    expect(capped.rentCapped).toBe(true);
  });

  it("incluye reforma con imprevistos y usa los datos reales de comunidad e IBI", () => {
    const f = analyze(facts({ reform_cost: 10_000, community_fee: 40, ibi: 300 }), A)!;
    expect(f.reform).toBeCloseTo(1_100_000);
    expect(f.opex.community).toBe(48_000);
    expect(f.opex.ibi).toBe(30_000);
  });

  it("la financiación al 70 % pide más capital", () => {
    const at70 = analyze(facts(), A, { ltvPct: 70 })!;
    expect(at70.equity).toBeGreaterThan(an.equity);
    expect(at70.payment).toBeLessThan(an.payment);
  });

  it("renta necesaria para una rentabilidad bruta", () => {
    expect(rentForGross(18_000_000, 8)).toBeCloseTo(120_000);
  });
});

describe("precio máximo", () => {
  it("toma el menor entre aportación y ROI, con renta conservadora", () => {
    const f = facts();
    const mp = maxPrice(f, A, C)!;
    expect(mp.byYield).toBeCloseTo((99_000 * 12) / 0.07, 0); // renta conservadora / 7 %
    expect(mp.byEquity).toBeCloseTo(5_000_000 / 0.3, 0); // entrada 20 % + ITP 10 %
    expect(mp.max).toBe(Math.min(mp.byEquity, mp.byRoi));
    const at = (p: number) => analyze(f, A, { purchasePrice: p, scenario: "conservative" })!;
    // Al precio máximo por aportación, la aportación es justo el tope
    expect(at(mp.byEquity).contribution).toBeCloseTo(5_000_000, 0);
    // Al precio máximo por ROI, el ROI con apalancamiento es justo el de «oportunidad»
    expect(at(mp.byRoi).leveragedRoi!).toBeCloseTo(0.1, 6);
    // Al precio máximo por cash flow, el cash flow es cero
    expect(at(mp.byCashflow).cashflowYear).toBeCloseTo(0, 0);
  });
});

describe("ROI con apalancamiento", () => {
  it("intereses del primer año con el cuadro de amortización", () => {
    // 100.000 € al 3,4 % a 25 años: ~3.360 € de intereses el primer año
    expect(firstYearInterest(10_000_000, 3.4, 25)).toBeGreaterThan(330_000);
    expect(firstYearInterest(10_000_000, 3.4, 25)).toBeLessThan(340_000);
    expect(firstYearInterest(0, 3.4, 25)).toBe(0);
  });

  it("resta intereses y gastos, no la amortización, y divide por entrada + ITP", () => {
    const an = analyze(facts(), A)!;
    expect(an.downPayment).toBeCloseTo(3_600_000);
    expect(an.contribution).toBeCloseTo(5_400_000);
    expect(an.leveragedRoi!).toBeCloseTo((an.rent * 12 - an.interestYear1 - an.opex.total) / 5_400_000, 9);
    expect(an.unleveragedRoi).toBeCloseTo((110_000 * 12) / 19_800_000, 9);
  });

  it("la renta necesaria para el ROI objetivo lo da justo", () => {
    const rent = rentForRoi(facts(), A, 10)!;
    expect(analyze(facts(), A, { rentOverride: rent })!.leveragedRoi!).toBeCloseTo(0.1, 5);
  });

  it("la revalorización suma al ROI total", () => {
    const an = analyze(facts(), A)!;
    const r = appreciation(an, 0.02);
    expect(r.yearly).toBeCloseTo(360_000);
    expect(r.totalRoi!).toBeCloseTo(an.leveragedRoi! + 360_000 / an.contribution, 9);
  });

  it("clasifica con la renta conservadora", () => {
    const good = evaluate(facts({ price: 110_000, rent: { conservative: 950, base: 1_050 } }), A, C);
    expect(good.roiClass).toBe("oportunidad");
    expect(good.meetsCriteria).toBe(true);
    const weak = evaluate(facts(), A, C);
    expect(weak.roiClass).toBe("fuera");
  });
});

describe("sensibilidades", () => {
  it("cada estrés empeora el cash flow", () => {
    const base = analyze(facts(), A)!;
    const rows = sensitivities(facts(), A);
    expect(rows).toHaveLength(4);
    for (const r of rows) expect(r.analysis.cashflowYear).toBeLessThan(base.cashflowYear);
  });
});

describe("evaluación", () => {
  it("sin renta queda pendiente de validar", () => {
    const ev = evaluate(facts({ rent: {} }), A, C);
    expect(ev.verdict).toBe("pendiente");
    expect(ev.base).toBeNull();
  });

  it("una operación que no llega pide rebaja", () => {
    const ev = evaluate(facts(), A, C);
    expect(ev.meetsCriteria).toBe(false);
    expect(ev.discountNeeded).toBeGreaterThan(0);
    expect(["esperar", "negociar", "descartar"]).toContain(ev.verdict);
  });

  it("una buena operación se puede comprar", () => {
    const ev = evaluate(facts({ price: 120_000, rent: { base: 1_000 } }), A, C);
    expect(ev.meetsCriteria).toBe(true);
    expect(ev.verdict).toBe("comprar");
    expect(ev.discountNeeded).toBe(0);
  });

  it("con confianza baja hay que investigar antes", () => {
    expect(evaluate(facts({ price: 120_000, rent: { base: 1_000 } }), A, C, "baja").verdict).toBe("investigar");
  });

  it("analiza al precio objetivo si es menor que el anunciado", () => {
    const ev = evaluate(facts({ target_price: 160_000 }), A, C);
    expect(ev.purchasePrice).toBe(16_000_000);
    expect(ev.atAsking!.purchasePrice).toBe(18_000_000);
  });

  it("por encima del tope excepcional se descarta si no cumple", () => {
    expect(evaluate(facts({ price: 260_000 }), A, C).verdict).toBe("descartar");
  });
});

describe("puntuación", () => {
  it("está entre 0 y 100 y premia el buen precio", () => {
    const cheap = facts({ market_price_sqm: 2_800 }); // 2.250 €/m² frente a 2.800
    const dear = facts({ market_price_sqm: 1_800 });
    expect(priceVsMarket(cheap)).toBeLessThan(0);
    const a = score(cheap, analyze(cheap, A), C);
    const b = score(dear, analyze(dear, A), C);
    expect(a.total).toBeGreaterThan(b.total);
    for (const s of [a, b]) {
      expect(s.total).toBeGreaterThanOrEqual(0);
      expect(s.total).toBeLessThanOrEqual(100);
    }
  });

  it("cash flow negativo no suma en ese apartado", () => {
    const f = facts({ rent: { base: 600 } });
    expect(score(f, analyze(f, A), C).cashflow).toBe(0);
  });
});

describe("historial de precio", () => {
  it("mide la rebaja desde el primer precio", () => {
    const h = [
      { price: 20_000_000, seen_at: "2026-11-01T00:00:00Z" },
      { price: 19_000_000, seen_at: "2026-11-10T00:00:00Z" },
    ];
    const change = priceChange(h, 19_000_000)!;
    expect(change.amount).toBe(-1_000_000);
    expect(change.pct).toBeCloseTo(-0.05, 9);
    expect(priceChange([], 1)).toBeNull();
  });
});
