import { describe, expect, it } from "vitest";
import { parseBbvaStatement } from "./bbva-statement";

// Texto de ejemplo con el formato del extracto (datos inventados)
const page1 = [
  "EXTRACTO MENSUAL DE CUENTAS PERSONALES",
  "EXTRACTO DE ENERO 2026 01/02/2026",
  "001IBAN ES00 0000 0000 0000 0000 0000",
  "SALDO ANTERIOR - - - - - - - - - 1.000,00",
  "02/01 31/12 PAGO CON TARJETA EN SUPERMERCADOS",
  "1234567812345678 SUPERMERCADO EJEMPLO ES",
  "-12,50 987,50",
  "05/01 05/01 ADEUDO A SU CARGO",
  "N 2026005000000001 SEGUROS EJEMPLO S.A.",
  "-21,19 966,31",
  "30/01 30/01 ABONO DE NOMINA POR TRANSFERENCIA",
  "SALARIO ENERO 2026",
  "1.950,00 2.916,31",
].join("\n");
const page2 = ["EXTRACTO DE ENERO 2026 01/02/2026", "31/01 31/01 BIZUM", "ENVIADO: Cena", "-15,00 2.901,31"].join("\n");

describe("extracto del BBVA en PDF", () => {
  it("lee periodo, movimientos y saldo final", () => {
    const r = parseBbvaStatement([page1, page2])!;
    expect(r.period).toBe("2026-01");
    expect(r.rows).toEqual([
      {
        booked_on: "2026-01-02",
        description: "PAGO CON TARJETA EN SUPERMERCADOS · SUPERMERCADO EJEMPLO ES",
        amount_cents: -1250,
      },
      { booked_on: "2026-01-05", description: "ADEUDO A SU CARGO · SEGUROS EJEMPLO S.A.", amount_cents: -2119 },
      {
        booked_on: "2026-01-30",
        description: "ABONO DE NOMINA POR TRANSFERENCIA · SALARIO ENERO 2026",
        amount_cents: 195000,
      },
      { booked_on: "2026-01-31", description: "BIZUM · ENVIADO: Cena", amount_cents: -1500 },
    ]);
    expect(r.closingBalanceCents).toBe(290131);
  });

  it("los saldos de cada movimiento cuadran con el anterior", () => {
    const r = parseBbvaStatement([page1, page2])!;
    const total = r.rows.reduce((s, x) => s + x.amount_cents, 0);
    expect(100000 + total).toBe(r.closingBalanceCents);
  });

  it("devuelve null si no es un extracto", () => {
    expect(parseBbvaStatement(["Otra cosa"])).toBeNull();
  });
});
