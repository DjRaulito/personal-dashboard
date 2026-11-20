"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fieldErrors, type FormState } from "@/lib/finance/schemas";
import { assumptionsSchema, criteriaSchema, STATUSES } from "@/lib/realestate/schemas";
import { createClient } from "@/lib/supabase/server";

async function session() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  return supabase;
}

const PAGE = "/tareas/inmuebles";
const id = z.uuid();

export async function setStatus(listingId: string, status: string) {
  const supabase = await session();
  await supabase
    .from("property_listings")
    .update({ status: z.enum(STATUSES).parse(status) })
    .eq("id", id.parse(listingId));
  revalidatePath(PAGE, "layout");
}

const notesSchema = z.object({
  id: z.uuid(),
  user_notes: z.string().trim().max(4000, "Máximo 4.000 caracteres").default(""),
  discard_reason: z.string().trim().max(300, "Máximo 300 caracteres").default(""),
});

export async function saveNotes(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = notesSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const supabase = await session();
  const { id: listingId, ...values } = parsed.data;
  const { error } = await supabase.from("property_listings").update(values).eq("id", listingId);
  if (error) return { ok: false, message: "No se pudieron guardar las notas." };
  revalidatePath(`${PAGE}/${listingId}`);
  return { ok: true, message: "Notas guardadas" };
}

export async function deleteListing(listingId: string) {
  const supabase = await session();
  await supabase.from("property_listings").delete().eq("id", id.parse(listingId));
  revalidatePath(PAGE, "layout");
  redirect(PAGE);
}

/** Los pesos van con prefijo `w_` en el formulario. */
function settingsFromForm(formData: FormData) {
  const entries = Object.fromEntries(formData);
  const weights = Object.fromEntries(
    Object.entries(entries)
      .filter(([k]) => k.startsWith("w_"))
      .map(([k, v]) => [k.slice(2), v]),
  );
  const num = (v: FormDataEntryValue) => (typeof v === "string" ? v.replace(",", ".") : v);
  const plain = Object.fromEntries(
    Object.entries(entries).map(([k, v]) => [k, k === "zones" || k === "notes" ? v : num(v)]),
  );
  return {
    assumptions: assumptionsSchema.safeParse(plain),
    criteria: criteriaSchema.safeParse({
      ...plain,
      weights: Object.fromEntries(Object.entries(weights).map(([k, v]) => [k, num(v)])),
    }),
  };
}

export async function saveSettings(_: FormState, formData: FormData): Promise<FormState> {
  const { assumptions, criteria } = settingsFromForm(formData);
  if (!assumptions.success)
    return { ok: false, errors: fieldErrors(assumptions.error), message: "Revisa los supuestos." };
  if (!criteria.success) return { ok: false, errors: fieldErrors(criteria.error), message: "Revisa los criterios." };
  const supabase = await session();
  const { error } = await supabase
    .from("property_settings")
    .upsert({ assumptions: assumptions.data, criteria: criteria.data, updated_at: new Date().toISOString() });
  if (error) return { ok: false, message: "No se pudieron guardar los ajustes." };
  revalidatePath(PAGE, "layout");
  return { ok: true, message: "Guardado. Todas las cuentas se han recalculado." };
}
