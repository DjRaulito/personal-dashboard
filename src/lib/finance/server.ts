import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { AccountWithBalance, AccountType } from "./accounts";
import type { Category, CategoryKind } from "./categories";
import { likePattern, monthBounds, PAGE_SIZE, type TransactionFilters } from "./filters";

export const getAccounts = cache(async (): Promise<AccountWithBalance[]> => {
  const supabase = await createClient();
  const [{ data: accounts, error }, { data: balances }] = await Promise.all([
    supabase.from("accounts").select("id, name, type, currency, initial_balance_cents, archived").order("name"),
    supabase.rpc("account_balances"),
  ]);
  if (error) throw error;
  const byId = new Map((balances ?? []).map((b) => [b.account_id, b.balance_cents]));
  return (accounts ?? []).map((a) => ({
    ...a,
    type: a.type as AccountType,
    balance_cents: byId.get(a.id) ?? a.initial_balance_cents,
  }));
});

export const getCategories = cache(async (): Promise<Category[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("categories").select("id, name, kind, parent_id").order("name");
  if (error) throw error;
  return (data ?? []).map((c) => ({ ...c, kind: c.kind as CategoryKind }));
});

export interface TransactionRow {
  id: string;
  account_id: string;
  booked_on: string;
  description: string;
  amount_cents: number;
  category_id: string | null;
  notes: string | null;
}

export async function listTransactions(filters: TransactionFilters) {
  const supabase = await createClient();
  const page = filters.pagina ?? 1;
  let query = supabase
    .from("transactions")
    .select("id, account_id, booked_on, description, amount_cents, category_id, notes", { count: "exact" })
    .order("booked_on", { ascending: false })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (filters.cuenta) query = query.eq("account_id", filters.cuenta);
  if (filters.categoria === "sin") query = query.is("category_id", null);
  else if (filters.categoria) {
    // Una categoría principal incluye sus subcategorías
    const categories = await getCategories();
    const ids = [filters.categoria, ...categories.filter((c) => c.parent_id === filters.categoria).map((c) => c.id)];
    query = query.in("category_id", ids);
  }
  if (filters.mes) {
    const { from, to } = monthBounds(filters.mes);
    query = query.gte("booked_on", from).lt("booked_on", to);
  }
  if (filters.tipo === "gastos") query = query.lt("amount_cents", 0);
  if (filters.tipo === "ingresos") query = query.gt("amount_cents", 0);
  if (filters.q) query = query.ilike("description", likePattern(filters.q));

  const { data, count, error } = await query;
  if (error) throw error;
  return { rows: (data ?? []) as TransactionRow[], total: count ?? 0, page };
}
