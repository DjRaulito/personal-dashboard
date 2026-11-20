import { formatCents } from "@/lib/finance/money";
import type { Verdict } from "@/lib/realestate/engine";
import { trendClass } from "@/lib/trend";

// Formatos de Inmuebles: céntimos sin decimales (son cifras grandes) y porcentajes con un decimal.

export const eur = (cents: number | null | undefined, signed = false) =>
  cents == null || !Number.isFinite(cents)
    ? "—"
    : formatCents(Math.round(cents / 100) * 100, "EUR", { signed }).replace(/,00(?=\s?€)/, "");

export const pct = (ratio: number | null | undefined, digits = 1) =>
  ratio == null || !Number.isFinite(ratio)
    ? "—"
    : `${(ratio * 100).toLocaleString("es-ES", { minimumFractionDigits: digits, maximumFractionDigits: digits })} %`;

export const num = (v: number | null | undefined, digits = 0) =>
  v == null ? "—" : v.toLocaleString("es-ES", { maximumFractionDigits: digits });

export const tone = trendClass;

/** Color de cada veredicto (tokens de DESIGN.md). */
export const VERDICT_TONE: Record<Verdict, { bg: string; text: string }> = {
  comprar: { bg: "bg-finance", text: "text-finance" },
  negociar: { bg: "bg-finance", text: "text-finance" },
  esperar: { bg: "bg-attention", text: "text-attention" },
  investigar: { bg: "bg-attention", text: "text-attention" },
  pendiente: { bg: "bg-content", text: "text-content" },
  descartar: { bg: "bg-expense", text: "text-expense" },
};

const dateFmt = new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeZone: "Europe/Madrid" });
const dateTimeFmt = new Intl.DateTimeFormat("es-ES", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Madrid",
});
export const date = (iso: string | null | undefined) => (iso ? dateFmt.format(new Date(iso)) : "—");
export const dateTime = (iso: string | null | undefined) => (iso ? dateTimeFmt.format(new Date(iso)) : "—");
