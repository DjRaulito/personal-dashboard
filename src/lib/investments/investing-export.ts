import { computeOpenLots, type EngineInput } from "./engine";

// CSV para "Import Portfolio → Positions" de Investing.com.
// Solo lotes abiertos (FIFO) como BUY: una venta importada crearía una posición corta.

const COLUMNS = ["Symbol", "Open Price", "Amount", "Type", "Open Date", "Commission", "Currency", "Name"];

const decimal = (n: number, digits: number) =>
  n
    .toFixed(digits)
    .replace(/\.?0+$/, "")
    .replace(".", ",");
const quote = (v: string) => `"${v.replace(/"/g, '""')}"`;

export function investingCsv(
  input: EngineInput,
  assets: { id: string; name: string; isin: string | null; symbol: string | null; currency: string }[],
  opts: { since?: string } = {},
): { csv: string; rows: number } {
  const lots = computeOpenLots(input);
  const lines = [COLUMNS.map(quote).join(",")];
  let rows = 0;
  for (const a of assets) {
    for (const lot of lots.get(a.id) ?? []) {
      if (lot.quantity < 1e-6) continue;
      if (opts.since && lot.date < opts.since) continue;
      // Precio de apertura: el de la operación; si no hay, el coste en euros por título
      const price = lot.price ?? lot.costEur / lot.quantity;
      const currency = a.currency === "GBX" ? "GBP" : a.currency;
      const openPrice = a.currency === "GBX" ? price / 100 : price;
      lines.push(
        [
          a.isin ?? a.symbol ?? a.name,
          decimal(openPrice, 6),
          decimal(lot.quantity, 8),
          "BUY",
          lot.date,
          "0",
          currency,
          a.name,
        ]
          .map(quote)
          .join(","),
      );
      rows++;
    }
  }
  return { csv: `${lines.join("\r\n")}\r\n`, rows };
}
