// Fondo value: cada resultado de la tarea «fondo-value» es una empresa en cartera o en vigilancia.
// Lógica pura (sin servidor): lectura de los datos y las cifras que se enseñan.
import type { TaskField } from "./fields";

export const FUND_SLUG = "fondo-value";

/** Campos que guarda la tarea (se registran en la BD y en el prompt de la tarea programada). */
export const FUND_FIELDS: TaskField[] = [
  { key: "empresa", label: "Empresa", type: "text" },
  { key: "estado", label: "Estado", type: "text" },
  { key: "precio", label: "Precio", type: "number" },
  { key: "entrada", label: "Entrada máx.", type: "number" },
  { key: "potencial", label: "EV", type: "percent" },
  { key: "tamano", label: "Tamaño", type: "text" },
  { key: "divisa", label: "Divisa", type: "text" },
  { key: "nota", label: "Nota de hoy", type: "text" },
  { key: "enlace", label: "Enlace", type: "url" },
  { key: "compra", label: "Precio de compra", type: "number" },
  { key: "fecha_compra", label: "Fecha de compra", type: "date" },
  { key: "peso", label: "Peso", type: "percent" },
  { key: "objetivo", label: "Precio de salida", type: "number" },
  { key: "bajista", label: "Escenario bajista", type: "number" },
  { key: "alcista", label: "Escenario alcista", type: "number" },
  { key: "prob_bajista", label: "Prob. bajista", type: "percent" },
  { key: "prob_base", label: "Prob. base", type: "percent" },
  { key: "prob_alcista", label: "Prob. alcista", type: "percent" },
  { key: "capitalizacion", label: "Capitalización", type: "text" },
  { key: "bolsa", label: "Bolsa", type: "text" },
  { key: "pais", label: "País", type: "text" },
  { key: "tesis", label: "Tesis", type: "text" },
  { key: "catalizador", label: "Catalizador", type: "text" },
  { key: "riesgos", label: "Riesgos", type: "text" },
  { key: "salida_si", label: "Sale si", type: "text" },
  { key: "evento", label: "Próximo evento", type: "text" },
];

export interface FundPosition {
  name: string;
  /** Ticker con mercado (MONC.MI): también es el símbolo de Yahoo. */
  ticker: string;
  state: "cartera" | "vigilancia" | "descartada" | "otro";
  price: number | null;
  currency: string;
  entryMax: number | null;
  ev: number | null;
  size: string | null;
  cap: string | null;
  buy: number | null;
  buyDate: string | null;
  weight: number | null;
  target: number | null;
  bear: number | null;
  bull: number | null;
  probs: { bear: number | null; base: number | null; bull: number | null };
  market: string | null;
  country: string | null;
  note: string | null;
  thesis: string | null;
  catalyst: string | null;
  risks: string | null;
  exitIf: string | null;
  nextEvent: string | null;
  link: string | null;
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

export function fundPosition(key: string, data: Record<string, unknown>): FundPosition {
  const state = str(data.estado)?.toLowerCase();
  return {
    name: str(data.empresa) ?? key,
    ticker: key,
    state: state === "cartera" || state === "vigilancia" || state === "descartada" ? state : "otro",
    price: num(data.precio),
    currency: str(data.divisa)?.toUpperCase() ?? "EUR",
    entryMax: num(data.entrada),
    ev: num(data.potencial),
    size: str(data.tamano),
    cap: str(data.capitalizacion),
    buy: num(data.compra),
    buyDate: str(data.fecha_compra),
    weight: num(data.peso),
    target: num(data.objetivo),
    bear: num(data.bajista),
    bull: num(data.alcista),
    probs: { bear: num(data.prob_bajista), base: num(data.prob_base), bull: num(data.prob_alcista) },
    market: str(data.bolsa),
    country: str(data.pais),
    note: str(data.nota),
    thesis: str(data.tesis),
    catalyst: str(data.catalizador),
    risks: str(data.riesgos),
    exitIf: str(data.salida_si),
    nextEvent: str(data.evento),
    link: str(data.enlace),
  };
}

/** Variación en % de `from` a `to` (null si falta alguno). */
export function pctChange(from: number | null, to: number | null): number | null {
  if (from == null || to == null || from <= 0) return null;
  return (to / from - 1) * 100;
}

/** Revalorización hasta el precio de salida desde hoy. */
export const upside = (p: FundPosition) => pctChange(p.price, p.target);
/** Rentabilidad desde la compra (cartera). */
export const sinceBuy = (p: FundPosition) => pctChange(p.buy, p.price);
/** Revalorización si se compra a la entrada máxima (vigilancia). */
export const upsideFromEntry = (p: FundPosition) => pctChange(p.entryMax, p.target);
/** Cuánto tiene que caer hoy para llegar a la entrada (negativo = ya está por debajo). */
export const toEntry = (p: FundPosition) => pctChange(p.price, p.entryMax);

const SIZE_LABELS: Record<string, string> = {
  micro: "Micro cap",
  small: "Small cap",
  mid: "Mid cap",
  large: "Large cap",
};
export const sizeLabel = (size: string | null) => (size ? (SIZE_LABELS[size.toLowerCase()] ?? size) : null);

/** Precio en su divisa: 39,43 €, 4.224 p (peniques de Londres), 12,50 US$… */
export function formatPrice(value: number | null, currency: string): string {
  if (value == null) return "—";
  if (currency === "GBX" || currency === "GBP_PENCE")
    return `${value.toLocaleString("es-ES", { maximumFractionDigits: 1 })} p`;
  try {
    return value.toLocaleString("es-ES", {
      style: "currency",
      currency,
      minimumFractionDigits: value >= 1000 ? 0 : 2,
      maximumFractionDigits: value >= 1000 ? 0 : 2,
    });
  } catch {
    return `${value.toLocaleString("es-ES")} ${currency}`;
  }
}

export const formatPct = (v: number | null, signed = true) =>
  v == null
    ? "—"
    : `${signed && v > 0 ? "+" : ""}${v.toLocaleString("es-ES", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} %`;

/** Media simple (ignora vacíos); null si no hay ninguno. */
export function average(values: (number | null)[]): number | null {
  const v = values.filter((x): x is number => x != null);
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
}
