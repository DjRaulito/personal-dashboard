import { z } from "zod";
import { ACCOUNT_TYPES } from "./accounts";
import { mappingSchema } from "./import";
import { parseAmountToCents } from "./money";

const amount = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const cents = parseAmountToCents(v, v.includes(",") || !v.includes(".") ? "," : ".");
    if (cents === null) {
      ctx.addIssue({ code: "custom", message: "Importe no válido" });
      return z.NEVER;
    }
    return cents;
  });

const optionalUuid = z
  .string()
  .optional()
  .transform((v) => (v ? v : null))
  .pipe(z.uuid().nullable());

export const accountFormSchema = z.object({
  id: optionalUuid,
  name: z.string().trim().min(1, "Pon un nombre").max(60),
  type: z.enum(ACCOUNT_TYPES),
  currency: z.string().regex(/^[A-Z]{3}$/),
  initial_balance: amount,
});

export const transactionFormSchema = z.object({
  id: optionalUuid,
  account_id: z.uuid("Elige una cuenta"),
  booked_on: z.iso.date("Fecha no válida"),
  description: z.string().trim().min(1, "Escribe un concepto").max(300),
  direction: z.enum(["gasto", "ingreso"]),
  amount: amount.refine((c) => c > 0, "El importe debe ser mayor que cero"),
  category_id: optionalUuid,
  notes: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((v) => v || null),
});

export const ruleFormSchema = z.object({
  pattern: z.string().trim().min(2, "El patrón es demasiado corto").max(100),
  match_type: z.enum(["contains", "starts_with", "equals"]),
  amount_sign: z.enum(["any", "expense", "income"]),
  category_id: z.uuid("Elige una categoría"),
  priority: z.coerce.number().int().min(0).max(1000).default(100),
  apply_now: z
    .string()
    .optional()
    .transform((v) => v === "on"),
});

export const categoryFormSchema = z.object({
  id: optionalUuid,
  name: z.string().trim().min(1, "Pon un nombre").max(60),
  kind: z.enum(["expense", "income", "transfer"]),
  parent_id: optionalUuid,
});

export const importSchema = z.object({
  accountId: z.uuid(),
  profileName: z.string().trim().max(60).optional(),
  mapping: mappingSchema.optional(),
  rows: z
    .array(
      z.object({
        booked_on: z.iso.date(),
        description: z.string().min(1).max(300),
        amount_cents: z
          .number()
          .int()
          .refine((n) => n !== 0 && Math.abs(n) < 1e12),
      }),
    )
    .min(1, "No hay movimientos que importar")
    .max(5000, "Máximo 5000 movimientos por importación"),
});

export type ImportInput = z.infer<typeof importSchema>;

export interface FormState {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
}

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}
