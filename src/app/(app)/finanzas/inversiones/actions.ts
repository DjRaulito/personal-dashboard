"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

async function session() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

function refresh() {
  revalidatePath("/finanzas", "layout");
  revalidatePath("/");
}

const draftAsset = z.object({
  key: z.string().min(1).max(60),
  name: z.string().min(1).max(120),
  isin: z
    .string()
    .regex(/^[A-Z]{2}[A-Z0-9]{9}\d$/)
    .nullable(),
  symbol: z.string().max(30).nullable(),
  market: z.string().max(30).nullable(),
  kind: z.enum(["fund", "stock", "etf", "pension", "other"]),
  currency: z.string().regex(/^[A-Z]{3}$/),
  broker: z.enum(["myinvestor", "mexem", "other"]),
});

const draftOperation = z.object({
  assetKey: z.string().min(1).max(60),
  type: z.enum(["buy", "sell", "dividend", "fee"]),
  date: z.iso.date(),
  quantity: z.number().min(0),
  price: z.number().nullable(),
  cashEur: z.number().nullable(),
  grossLocal: z.number().nullable(),
  source: z.enum(["investing", "myinvestor", "mexem", "manual"]),
  externalId: z.string().min(1).max(200),
  split: z.boolean().optional(),
});

const importSchema = z.object({
  assets: z.array(draftAsset).max(500),
  operations: z.array(draftOperation).min(1).max(5000),
  /** Borra antes las operaciones importadas (no las manuales): para volver a cargar todo de cero. */
  replace: z.boolean().default(false),
});

export interface PortfolioImportResult {
  ok: boolean;
  message: string;
  newAssets?: number;
  newOperations?: number;
}

/** Guarda activos y operaciones conciliados. Reimportar no duplica (external_id). */
export async function importPortfolio(input: z.input<typeof importSchema>): Promise<PortfolioImportResult> {
  const parsed = importSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Datos de importación no válidos." };
  const { supabase } = await session();
  const { assets, operations, replace } = parsed.data;

  let touched: string[] = [];
  if (replace) {
    const { data: removed, error } = await supabase
      .from("investment_operations")
      .delete()
      .neq("source", "manual")
      .select("asset_id");
    if (error) return { ok: false, message: "No se pudieron borrar las operaciones anteriores." };
    touched = [...new Set((removed ?? []).map((r) => r.asset_id))];
  }

  const { data: existing } = await supabase.from("assets").select("id, isin, symbol");
  const idByKey = new Map<string, string>();
  for (const a of assets) {
    // Por ISIN; si no, por símbolo de Investing (y entonces se completa el ISIN que faltaba)
    const hit =
      existing?.find((e) => a.isin && e.isin === a.isin) ??
      existing?.find((e) => a.symbol && e.symbol === a.symbol && (!e.isin || !a.isin));
    if (hit) {
      idByKey.set(a.key, hit.id);
      if (!hit.isin && a.isin) {
        await supabase.from("assets").update({ isin: a.isin, broker: a.broker }).eq("id", hit.id);
        hit.isin = a.isin;
      }
    }
  }
  const toInsert = assets.filter((a) => !idByKey.has(a.key));
  if (toInsert.length) {
    const { data, error } = await supabase
      .from("assets")
      .insert(toInsert.map(({ key, ...a }) => (void key, a)))
      .select("id, isin, symbol");
    if (error) return { ok: false, message: "No se pudieron guardar los activos." };
    for (const a of toInsert) {
      const row = data?.find((d) => (a.isin ? d.isin === a.isin : d.symbol === a.symbol));
      if (row) idByKey.set(a.key, row.id);
    }
  }
  // Completar símbolo y mercado de activos existentes que no los tenían
  for (const a of assets) {
    const hit = existing?.find((e) => e.id === idByKey.get(a.key));
    if (hit && !hit.symbol && a.symbol) {
      await supabase.from("assets").update({ symbol: a.symbol, market: a.market }).eq("id", hit.id);
    }
  }

  const rows = operations
    .filter((o) => idByKey.has(o.assetKey))
    .map((o) => ({
      asset_id: idByKey.get(o.assetKey)!,
      type: o.type,
      trade_date: o.date,
      quantity: o.quantity,
      price: o.price,
      cash_eur_cents: o.cashEur == null ? null : Math.round(o.cashEur * 100),
      gross_local: o.grossLocal,
      is_split: !!o.split,
      source: o.source,
      external_id: o.externalId,
    }));
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const { data, error } = await supabase
      .from("investment_operations")
      .upsert(rows.slice(i, i + 500), { onConflict: "user_id,external_id", ignoreDuplicates: true })
      .select("id");
    if (error) return { ok: false, message: `Error al guardar operaciones (llevaba ${inserted}).` };
    inserted += data.length;
  }
  // Activos que se quedaron sin operaciones al reemplazar (p. ej. duplicados antiguos)
  if (touched.length) {
    const { data: still } = await supabase.from("investment_operations").select("asset_id").in("asset_id", touched);
    const alive = new Set((still ?? []).map((r) => r.asset_id));
    const orphans = touched.filter((id) => !alive.has(id));
    if (orphans.length) await supabase.from("assets").delete().in("id", orphans);
  }

  refresh();
  return {
    ok: true,
    message: replace ? "Cartera reemplazada." : "Cartera importada.",
    newAssets: toInsert.length,
    newOperations: inserted,
  };
}

const operationForm = z.object({
  asset_id: z.uuid(),
  type: z.enum(["buy", "sell", "dividend", "fee"]),
  trade_date: z.iso.date(),
  quantity: z.coerce.number().min(0),
  price: z.coerce.number().min(0).optional(),
  cash_eur: z.coerce.number(),
  notes: z.string().trim().max(500).optional(),
});

export async function addOperation(_: unknown, formData: FormData): Promise<{ ok: boolean; message: string }> {
  const raw = Object.fromEntries(
    [...formData.entries()].map(([k, v]) => [k, typeof v === "string" ? v.replace(",", ".").trim() : v]),
  );
  const parsed = operationForm.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Revisa los campos." };
  const { cash_eur, ...op } = parsed.data;
  if ((op.type === "buy" || op.type === "sell") && op.quantity <= 0) {
    return { ok: false, message: "La cantidad debe ser mayor que cero." };
  }
  const { supabase } = await session();
  // Compra/comisión = sale dinero (+); venta/dividendo = entra (−)
  const sign = op.type === "buy" || op.type === "fee" ? 1 : -1;
  const { error } = await supabase.from("investment_operations").insert({
    ...op,
    quantity: op.type === "buy" || op.type === "sell" ? op.quantity : 0,
    price: op.price ?? null,
    cash_eur_cents: Math.round(Math.abs(cash_eur) * 100) * sign,
    source: "manual",
  });
  if (error) return { ok: false, message: "No se pudo guardar la operación." };
  refresh();
  return { ok: true, message: "Operación añadida." };
}

export async function deleteOperation(id: string) {
  const { supabase } = await session();
  await supabase.from("investment_operations").delete().eq("id", id);
  refresh();
}

const assetForm = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(120),
  kind: z.enum(["fund", "stock", "etf", "pension", "other"]),
  price_source: z.enum(["yahoo", "manual"]),
  price_symbol: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => v || null),
});

export async function updateAsset(_: unknown, formData: FormData): Promise<{ ok: boolean; message: string }> {
  const parsed = assetForm.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: "Revisa los campos." };
  const { supabase } = await session();
  const { id, ...values } = parsed.data;
  const { data: before } = await supabase.from("assets").select("price_symbol").eq("id", id).single();
  const { error } = await supabase.from("assets").update(values).eq("id", id);
  if (error) return { ok: false, message: "No se pudo guardar." };
  // Si cambia el símbolo, se borran los precios descargados para volver a pedirlos
  if (before && before.price_symbol !== values.price_symbol) {
    await supabase.from("asset_prices").delete().eq("asset_id", id).eq("source", "yahoo");
  }
  refresh();
  return { ok: true, message: "Activo actualizado." };
}

const manualPrice = z.object({
  asset_id: z.uuid(),
  price_date: z.iso.date(),
  close: z.coerce.number().positive(),
});

/** Valor liquidativo puesto a mano (planes de pensiones u otros sin cotización). */
export async function addManualPrice(_: unknown, formData: FormData): Promise<{ ok: boolean; message: string }> {
  const raw = Object.fromEntries(
    [...formData.entries()].map(([k, v]) => [k, typeof v === "string" ? v.replace(",", ".").trim() : v]),
  );
  const parsed = manualPrice.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Revisa los campos." };
  const { supabase } = await session();
  const { error } = await supabase.from("asset_prices").upsert({ ...parsed.data, source: "manual" });
  if (error) return { ok: false, message: "No se pudo guardar el precio." };
  refresh();
  return { ok: true, message: "Precio guardado." };
}

const newAssetForm = z.object({
  name: z.string().trim().min(1).max(120),
  isin: z
    .string()
    .trim()
    .toUpperCase()
    .optional()
    .transform((v) => v || null)
    .pipe(
      z
        .string()
        .regex(/^[A-Z]{2}[A-Z0-9]{9}\d$/, "ISIN no válido")
        .nullable(),
    ),
  kind: z.enum(["fund", "stock", "etf", "pension", "other"]),
  currency: z.string().regex(/^[A-Z]{3}$/),
  price_source: z.enum(["yahoo", "manual"]),
});

/** Alta manual de un activo (p. ej. un plan de pensiones). */
export async function createAsset(_: unknown, formData: FormData): Promise<{ ok: boolean; message: string }> {
  const parsed = newAssetForm.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Revisa los campos." };
  const { supabase } = await session();
  const { error } = await supabase.from("assets").insert({ ...parsed.data, broker: "other" });
  if (error)
    return { ok: false, message: error.code === "23505" ? "Ese activo ya existe." : "No se pudo crear el activo." };
  refresh();
  return { ok: true, message: "Activo creado. Ahora añade sus aportaciones en Operaciones y su valor en la ficha." };
}
