"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getPortfolio } from "@/lib/investments/server";
import type { Database } from "@/lib/supabase/database.types";
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
  revalidatePath("/inversiones", "layout");
  revalidatePath("/");
}

const decimal = z.preprocess((v) => (typeof v === "string" ? Number(v.replace(",", ".").trim()) : v), z.number());

const isinField = z
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
  );

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

export async function deleteOperation(id: string) {
  const { supabase } = await session();
  await supabase.from("investment_operations").delete().eq("id", id);
  refresh();
}

const assetForm = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(120),
  isin: isinField,
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

// ---------------------------------------------------------------------------
// Operaciones desde la lista de posiciones (Nueva compra, Comprar más, Vender, Cerrar…)
// ---------------------------------------------------------------------------

const tradeInput = z
  .object({
    assetId: z.uuid().nullable(),
    newAsset: z
      .object({
        name: z.string().trim().min(1, "Ponle un nombre").max(120),
        isin: isinField,
        priceSymbol: z
          .string()
          .trim()
          .max(40)
          .optional()
          .transform((v) => v || null),
        kind: z.enum(["fund", "stock", "etf", "pension", "other"]),
        currency: z.string().regex(/^[A-Z]{3}$/, "Moneda no válida"),
        priceSource: z.enum(["yahoo", "manual"]),
      })
      .nullable(),
    type: z.enum(["buy", "sell", "dividend", "fee"]),
    /** Vender todas las participaciones (Cerrar posición). */
    closeAll: z.boolean().default(false),
    date: z.iso.date("Fecha no válida"),
    quantity: decimal.pipe(z.number().min(0)).default(0),
    /** Precio por participación, en la moneda del activo. */
    price: decimal.pipe(z.number().min(0)).nullable().default(null),
    /** Importe en euros (dividendos y comisiones sueltas). */
    amount: decimal.pipe(z.number().min(0)).nullable().default(null),
    /** Comisión de la compra o venta, en euros. */
    fee: decimal.pipe(z.number().min(0)).default(0),
    notes: z.string().trim().max(500).optional(),
  })
  .refine((v) => v.assetId || v.newAsset, "Elige el activo.");

export type TradeResult = { ok: true; message: string; assetId: string } | { ok: false; message: string };

/** Guarda una compra, venta, cierre, dividendo o comisión; crea el activo si es nuevo. */
export async function recordTrade(input: unknown): Promise<TradeResult> {
  const parsed = tradeInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Revisa los campos." };
  const t = parsed.data;
  const { supabase } = await session();

  let assetId = t.assetId;
  let currency = "EUR";
  if (assetId) {
    const { data: asset } = await supabase.from("assets").select("currency").eq("id", assetId).maybeSingle();
    if (!asset) return { ok: false, message: "Ese activo no existe." };
    currency = asset.currency;
  } else if (t.newAsset) {
    const { data: created, error } = await supabase
      .from("assets")
      .insert({
        name: t.newAsset.name,
        isin: t.newAsset.isin,
        kind: t.newAsset.kind,
        currency: t.newAsset.currency,
        price_source: t.newAsset.priceSource,
        price_symbol: t.newAsset.priceSymbol,
        broker: "other",
      })
      .select("id")
      .single();
    if (error || !created) {
      return {
        ok: false,
        message: error?.code === "23505" ? "Ese activo ya existe: búscalo en la lista." : "No se pudo crear el activo.",
      };
    }
    assetId = created.id;
    currency = t.newAsset.currency;
  }
  if (!assetId) return { ok: false, message: "Elige el activo." };

  const rows: Database["public"]["Tables"]["investment_operations"]["Insert"][] = [];
  const base = { asset_id: assetId, trade_date: t.date, source: "manual", notes: t.notes || null };
  if (t.type === "buy" || t.type === "sell") {
    let quantity = t.quantity;
    if (t.type === "sell") {
      const held = (await getPortfolio()).positions.get(assetId)?.quantity ?? 0;
      if (t.closeAll) quantity = held;
      if (quantity <= 0) return { ok: false, message: "No tienes participaciones que vender." };
      if (quantity > held + 1e-6) return { ok: false, message: "Vendes más participaciones de las que tienes." };
    }
    if (quantity <= 0) return { ok: false, message: "Las participaciones deben ser más que cero." };
    if (t.price == null || t.price <= 0) return { ok: false, message: "Indica el precio por participación." };
    const gross = quantity * t.price;
    const sign = t.type === "buy" ? 1 : -1;
    rows.push({
      ...base,
      type: t.type,
      quantity,
      price: t.price,
      // En euros se guarda el efectivo exacto; en otra moneda, el bruto (se convierte con el cambio del día)
      cash_eur_cents: currency === "EUR" ? Math.round(gross * 100) * sign : null,
      gross_local: currency === "EUR" ? null : gross * sign,
    });
    if (t.fee > 0) {
      rows.push({
        ...base,
        type: "fee",
        quantity: 0,
        price: null,
        cash_eur_cents: Math.round(t.fee * 100),
        notes: "Comisión",
      });
    }
  } else {
    if (t.amount == null || t.amount <= 0) return { ok: false, message: "Indica el importe en euros." };
    rows.push({
      ...base,
      type: t.type,
      quantity: 0,
      price: null,
      cash_eur_cents: Math.round(t.amount * 100) * (t.type === "fee" ? 1 : -1),
    });
  }

  const { error } = await supabase.from("investment_operations").insert(rows);
  if (error) return { ok: false, message: "No se pudo guardar la operación." };
  refresh();
  const done = {
    buy: "Compra guardada.",
    sell: t.closeAll ? "Posición cerrada." : "Venta guardada.",
    dividend: "Dividendo guardado.",
    fee: "Comisión guardada.",
  };
  return { ok: true, message: done[t.type], assetId };
}

const operationEdit = z.object({
  id: z.uuid(),
  date: z.iso.date("Fecha no válida"),
  quantity: decimal.pipe(z.number().min(0)),
  price: decimal.pipe(z.number().min(0)).nullable(),
  /** Importe en euros, sin signo (el signo lo pone el tipo). */
  amount: decimal.pipe(z.number().min(0)).nullable(),
});

/** Corrige una operación desde el panel de la posición. */
export async function updateOperation(input: unknown): Promise<{ ok: boolean; message: string }> {
  const parsed = operationEdit.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Revisa los campos." };
  const e = parsed.data;
  const { supabase } = await session();
  const { data: op } = await supabase
    .from("investment_operations")
    .select("type, assets(currency)")
    .eq("id", e.id)
    .maybeSingle();
  if (!op) return { ok: false, message: "Esa operación no existe." };
  const currency = (op.assets as { currency: string } | null)?.currency ?? "EUR";
  const sign = op.type === "buy" || op.type === "fee" ? 1 : -1;
  const trade = op.type === "buy" || op.type === "sell";
  if (trade && (e.quantity <= 0 || !e.price)) return { ok: false, message: "Pon participaciones y precio." };
  const values: Database["public"]["Tables"]["investment_operations"]["Update"] = trade
    ? {
        trade_date: e.date,
        quantity: e.quantity,
        price: e.price,
        cash_eur_cents: currency === "EUR" ? Math.round((e.amount ?? e.quantity * e.price!) * 100) * sign : null,
        gross_local: currency === "EUR" ? null : e.quantity * e.price! * sign,
      }
    : { trade_date: e.date, cash_eur_cents: Math.round((e.amount ?? 0) * 100) * sign };
  const { error } = await supabase.from("investment_operations").update(values).eq("id", e.id);
  if (error) return { ok: false, message: "No se pudo guardar." };
  refresh();
  return { ok: true, message: "Operación corregida." };
}

/** Borra un activo con todas sus operaciones y precios. */
export async function deleteAsset(id: string): Promise<{ ok: boolean; message: string }> {
  const assetId = z.uuid().safeParse(id);
  if (!assetId.success) return { ok: false, message: "Activo no válido." };
  const { supabase } = await session();
  const { error } = await supabase.from("assets").delete().eq("id", assetId.data);
  if (error) return { ok: false, message: "No se pudo borrar." };
  refresh();
  return { ok: true, message: "Activo borrado." };
}
