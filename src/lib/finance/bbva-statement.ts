import type { ParsedRow } from "./import";

const MONTHS = [
  "ENERO",
  "FEBRERO",
  "MARZO",
  "ABRIL",
  "MAYO",
  "JUNIO",
  "JULIO",
  "AGOSTO",
  "SEPTIEMBRE",
  "OCTUBRE",
  "NOVIEMBRE",
  "DICIEMBRE",
];

export interface StatementParse {
  /** YYYY-MM del extracto. */
  period: string;
  rows: ParsedRow[];
  /** Saldo tras el último movimiento, en céntimos (para comprobar). */
  closingBalanceCents: number | null;
}

const HEAD = /^(\d{2})\/(\d{2}) (\d{2})\/(\d{2}) (.+)$/;
const AMOUNTS = /^(-?[\d.]+,\d{2}) (-?[\d.]+,\d{2})$/;
const toCents = (s: string) => Math.round(Number(s.replace(/\./g, "").replace(",", ".")) * 100);

/** Limpia la línea de detalle: quita el número de tarjeta y las referencias de recibo. */
function cleanDetail(line: string): string {
  return line
    .replace(/^\d{16}\s*/, "")
    .replace(/^N \d{10,}\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Lee el texto de un extracto mensual en PDF del BBVA (una cadena por página). Cada movimiento son
 * tres líneas: «F.Oper. F.Valor CONCEPTO», el detalle (comercio, ordenante…) y «importe saldo».
 */
export function parseBbvaStatement(pages: string[]): StatementParse | null {
  const all = pages.join("\n");
  const header = all.match(/EXTRACTO DE ([A-ZÁÉÍÓÚ]+) (\d{4})/);
  if (!header) return null;
  const month = MONTHS.indexOf(header[1]) + 1;
  if (month === 0) return null;
  const year = Number(header[2]);
  const period = `${year}-${String(month).padStart(2, "0")}`;

  const rows: ParsedRow[] = [];
  let closing: number | null = null;
  for (const page of pages) {
    const lines = page.split("\n").map((l) => l.trim());
    for (let i = 0; i < lines.length; i++) {
      const head = lines[i].match(HEAD);
      if (!head) continue;
      // El detalle puede ocupar varias líneas hasta la de importes
      const detail: string[] = [];
      let j = i + 1;
      while (j < lines.length && j <= i + 4 && !AMOUNTS.test(lines[j]) && !HEAD.test(lines[j])) detail.push(lines[j++]);
      const amounts = lines[j]?.match(AMOUNTS);
      if (!amounts) continue;
      const [, dd, mm, , , concept] = head;
      const opMonth = Number(mm);
      // Un movimiento de diciembre en el extracto de enero es del año anterior
      const opYear = opMonth > month ? year - 1 : year;
      const extra = detail.map(cleanDetail).filter(Boolean).join(" ");
      rows.push({
        booked_on: `${opYear}-${mm}-${dd}`,
        description: (extra ? `${concept.trim()} · ${extra}` : concept.trim()).slice(0, 300),
        amount_cents: toCents(amounts[1]),
      });
      closing = toCents(amounts[2]);
      i = j;
    }
  }
  return { period, rows, closingBalanceCents: closing };
}
