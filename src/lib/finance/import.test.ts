import { describe, expect, it } from "vitest";
import { guessMapping, importKeys, mapRows, parseDate, type ImportMapping } from "./import";

describe("parseDate", () => {
  it("formatos habituales", () => {
    expect(parseDate("09/11/2026", "DD/MM/YYYY")).toBe("2026-11-09");
    expect(parseDate("9-11-26", "DD/MM/YY")).toBe("2026-11-09");
    expect(parseDate("2026-11-09", "YYYY-MM-DD")).toBe("2026-11-09");
    expect(parseDate("11/09/2026", "MM/DD/YYYY")).toBe("2026-11-09");
  });

  it("Date y serie de Excel", () => {
    expect(parseDate(new Date(Date.UTC(2026, 10, 9)), "DD/MM/YYYY")).toBe("2026-11-09");
    expect(parseDate(46335, "DD/MM/YYYY")).toBe("2026-11-09");
  });

  it("rechaza fechas imposibles", () => {
    expect(parseDate("31/02/2026", "DD/MM/YYYY")).toBeNull();
    expect(parseDate("hola", "DD/MM/YYYY")).toBeNull();
  });
});

const sheet = [
  ["Extracto de la cuenta"],
  [""],
  ["Fecha operación", "Fecha valor", "Concepto", "Importe", "Saldo"],
  ["09/11/2026", "09/11/2026", "COMPRA MERCADONA", "-45,30", "1.000,00"],
  ["09/11/2026", "09/11/2026", "CAFE", "-1,50", "998,50"],
  ["09/11/2026", "09/11/2026", "CAFE", "-1,50", "997,00"],
  ["", "", "", "", ""],
  ["xx", "", "MAL", "1", ""],
  ["10/11/2026", "", "NÓMINA", "1.500,00", ""],
];

describe("guessMapping + mapRows", () => {
  it("detecta la cabecera de un extracto español", () => {
    const m = guessMapping(sheet);
    expect(m).toMatchObject({
      skipRows: 2,
      dateColumn: 0,
      descriptionColumns: [2],
      amountMode: "single",
      amountColumn: 3,
      decimal: ",",
      dateFormat: "DD/MM/YYYY",
    });
  });

  it("convierte filas, salta vacías y reporta errores con su línea", () => {
    const { rows, errors } = mapRows(sheet, guessMapping(sheet) as ImportMapping);
    expect(rows).toEqual([
      { booked_on: "2026-11-09", description: "COMPRA MERCADONA", amount_cents: -4530 },
      { booked_on: "2026-11-09", description: "CAFE", amount_cents: -150 },
      { booked_on: "2026-11-09", description: "CAFE", amount_cents: -150 },
      { booked_on: "2026-11-10", description: "NÓMINA", amount_cents: 150000 },
    ]);
    expect(errors).toEqual([{ line: 8, reason: "Fecha no válida" }]);
  });

  it("columnas de cargo y abono", () => {
    const split = [
      ["Fecha", "Descripción", "Cargo", "Abono"],
      ["2026-11-01", "Recibo luz", "60.10", ""],
      ["2026-11-02", "Transferencia", "", "200.00"],
    ];
    const m = guessMapping(split) as ImportMapping;
    expect(m).toMatchObject({
      amountMode: "split",
      debitColumn: 2,
      creditColumn: 3,
      decimal: ".",
      dateFormat: "YYYY-MM-DD",
    });
    expect(mapRows(split, m).rows.map((r) => r.amount_cents)).toEqual([-6010, 20000]);
  });

  it("invertir signo (tarjetas que muestran los gastos en positivo)", () => {
    const m = { ...(guessMapping(sheet) as ImportMapping), invertSign: true };
    expect(mapRows(sheet, m).rows[0].amount_cents).toBe(4530);
  });
});

describe("importKeys", () => {
  it("distingue movimientos idénticos el mismo día y es estable", () => {
    const rows = mapRows(sheet, guessMapping(sheet) as ImportMapping).rows;
    const keys = importKeys(rows);
    expect(new Set(keys).size).toBe(rows.length);
    expect(importKeys(rows)).toEqual(keys);
    expect(keys[1]).toMatch(/\|1$/);
    expect(keys[2]).toMatch(/\|2$/);
  });
});
