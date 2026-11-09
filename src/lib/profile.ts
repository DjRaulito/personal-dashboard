import { z } from "zod";

export const CURRENCIES = ["EUR", "USD", "GBP"] as const;

export const profileSchema = z.object({
  display_name: z
    .string()
    .trim()
    .max(80)
    .transform((v) => v || null),
  currency: z.enum(CURRENCIES),
});
