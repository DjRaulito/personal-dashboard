import { normalizeText } from "./text";

export type MatchType = "contains" | "starts_with" | "equals";
export type AmountSign = "any" | "expense" | "income";

export interface Rule {
  id: string;
  pattern: string;
  match_type: MatchType;
  amount_sign: AmountSign;
  category_id: string;
  priority: number;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Prepara las reglas: normaliza patrones, compila y ordena por prioridad. */
export function compileRules(rules: Rule[]) {
  return [...rules]
    .sort((a, b) => a.priority - b.priority || b.pattern.length - a.pattern.length)
    .map((rule) => {
      const pattern = normalizeText(rule.pattern);
      // "contains" = palabra o frase completa: no vale "DIGI" dentro de "DIGITAL"
      const regex =
        rule.match_type === "contains" ? new RegExp(`(^|[^A-Z0-9])${escapeRegExp(pattern)}($|[^A-Z0-9])`) : null;
      return { ...rule, pattern, regex };
    });
}

export type CompiledRules = ReturnType<typeof compileRules>;

export function ruleMatches(rule: CompiledRules[number], description: string, amountCents: number): boolean {
  if (rule.amount_sign === "expense" && amountCents >= 0) return false;
  if (rule.amount_sign === "income" && amountCents <= 0) return false;
  const text = normalizeText(description);
  if (rule.match_type === "equals") return text === rule.pattern;
  if (rule.match_type === "starts_with") return text.startsWith(rule.pattern);
  return rule.regex!.test(text);
}

/** Devuelve la categoría de la primera regla que encaja, o null. */
export function categorize(rules: CompiledRules, description: string, amountCents: number): string | null {
  for (const rule of rules) {
    if (ruleMatches(rule, description, amountCents)) return rule.category_id;
  }
  return null;
}

/** Propone un patrón para crear una regla a partir de un concepto bancario. */
export function suggestPattern(description: string): string {
  const words = normalizeText(description)
    // Quita prefijos típicos de extractos españoles
    .replace(/^(COMPRA|PAGO|RECIBO|TRANSFERENCIA|ADEUDO|CARGO|TARJETA|EN|DE|A FAVOR DE|BIZUM)\b[ :]*/g, "")
    .replace(/^(COMPRA|PAGO|RECIBO|TARJETA|EN|DE)\b[ :]*/g, "")
    .split(" ")
    .filter((w) => /[A-Z]/.test(w) && !/\d{3,}/.test(w));
  return words.slice(0, 2).join(" ");
}
