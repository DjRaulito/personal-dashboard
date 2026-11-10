// Resumen semanal de la portada: qué semana se resume y el prompt del comentario (puro).
import { z } from "zod";
import { addDaysIso } from "./assistant";

/** Última semana completa (lunes a domingo) antes de `today` (YYYY-MM-DD). */
export function lastWeek(today: string): { start: string; end: string } {
  const isoDow = ((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7) + 1; // 1 = lunes
  const start = addDaysIso(today, -(isoDow - 1) - 7);
  return { start, end: addDaysIso(start, 6) };
}

export interface WeeklyStats {
  start: string;
  end: string;
  expenseEur: number | null;
  workouts: number;
  sets: number;
  /** Comidas según el plan sobre las previstas en la semana (0-1), o null sin plan. */
  dietRatio: number | null;
  mealsMarked: number;
  cheats: number;
  weightKg: number | null;
  weightDeltaKg: number | null;
}

export const weeklyCommentSchema = z.object({ comment: z.string().min(1).max(1500) });

export const SYSTEM_WEEKLY =
  "Eres el asistente personal de Raúl. Respondes SIEMPRE con un único objeto JSON válido, sin texto adicional.";

export function weeklyPrompt(stats: WeeklyStats, detail: unknown): string {
  return [
    `Escribe un comentario breve sobre su semana del ${stats.start} al ${stats.end} (finanzas, gimnasio, dieta y peso).`,
    "3-4 frases en español, tono cercano y directo, en segunda persona. Destaca lo mejor, lo que flojea y una sugerencia concreta para esta semana.",
    "Usa solo los datos que te paso; si falta algo (p. ej. no hay movimientos), no lo menciones o dilo en pocas palabras. Sin consejos médicos.",
    "Puedes usar **negrita** para 1-2 cifras clave. Nada de listas ni títulos.",
    `Resumen: ${JSON.stringify(stats)}`,
    `Detalle: ${JSON.stringify(detail).slice(0, 12000)}`,
    'Devuelve: {"comment": "..."}',
  ].join("\n");
}
