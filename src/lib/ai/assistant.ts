// Piezas puras del asistente: fechas de los argumentos, instrucciones y un mini-markdown seguro.

import { z } from "zod";

export const MAX_RANGE_DAYS = 800;

const isoDate = z.iso.date();

function addDaysIso(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Normaliza un rango [desde, hasta] (ambos incluidos) que propone el modelo: valores por
 * defecto, orden correcto y un tope de días para no leer media base de datos.
 */
export function dateRange(
  args: Record<string, unknown>,
  today: string,
  defaultDays: number,
  maxDays = MAX_RANGE_DAYS,
): { from: string; to: string } {
  const parse = (v: unknown) => (isoDate.safeParse(v).success ? (v as string) : null);
  let to = parse(args.hasta) ?? today;
  let from = parse(args.desde) ?? addDaysIso(to, -(defaultDays - 1));
  if (from > to) [from, to] = [to, from];
  if (addDaysIso(from, maxDays) < to) from = addDaysIso(to, -maxDays);
  return { from, to };
}

export { addDaysIso };

export const RANGE_PARAMS = {
  desde: { type: "string", description: "Fecha inicial incluida, formato YYYY-MM-DD" },
  hasta: { type: "string", description: "Fecha final incluida, formato YYYY-MM-DD" },
} as const;

export function assistantSystem(today: string, weekday: string): string {
  return [
    "Eres el asistente personal de Raúl dentro de su dashboard (finanzas, inversiones, gimnasio, nutrición y agenda).",
    `Hoy es ${weekday} ${today} (zona Europe/Madrid). Interpreta "este mes", "la semana pasada", etc. a partir de esta fecha.`,
    "Para responder sobre sus datos usa SIEMPRE las herramientas; nunca inventes cifras. Si una herramienta no devuelve datos, dilo tal cual.",
    "Puedes llamar a varias herramientas y combinarlas (por ejemplo, gasto en comida y cumplimiento de la dieta).",
    "Importes en euros con formato español (1.234,56 €). Pesos de comida en crudo, como en su plan.",
    "Responde en español, breve y directo: primero la respuesta, luego 2-5 viñetas con el detalle si hace falta.",
    "Usa solo este formato: párrafos, viñetas con '- ' y **negrita**. Nada de tablas, títulos ni enlaces.",
    "No das consejos médicos ni financieros profesionales; si te los piden, aporta datos y sugiere consultar a un profesional.",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Mini-markdown: párrafos, viñetas y negrita. Sin HTML, para renderizarlo como texto en React.
// ---------------------------------------------------------------------------

export type Inline = { bold: boolean; text: string };
export type Block = { kind: "p"; lines: Inline[][] } | { kind: "ul"; items: Inline[][] };

export function parseInline(line: string): Inline[] {
  const out: Inline[] = [];
  const parts = line.split(/(\*\*[^*]+\*\*)/g);
  for (const p of parts) {
    if (!p) continue;
    if (p.startsWith("**") && p.endsWith("**") && p.length > 4) out.push({ bold: true, text: p.slice(2, -2) });
    else out.push({ bold: false, text: p.replace(/\*\*/g, "") });
  }
  return out;
}

export function parseMarkdown(text: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const line = raw.trimEnd();
    const bullet = /^\s*(?:[-*•]|\d+[.)])\s+(.*)$/.exec(line);
    const last = blocks.at(-1);
    if (!line.trim()) {
      blocks.push({ kind: "p", lines: [] });
      continue;
    }
    const clean = line.replace(/^#+\s*/, "");
    if (bullet) {
      if (last?.kind === "ul") last.items.push(parseInline(bullet[1]));
      else blocks.push({ kind: "ul", items: [parseInline(bullet[1])] });
    } else if (last?.kind === "p") {
      last.lines.push(parseInline(clean));
    } else {
      blocks.push({ kind: "p", lines: [parseInline(clean)] });
    }
  }
  return blocks.filter((b) => (b.kind === "p" ? b.lines.length > 0 : b.items.length > 0));
}
