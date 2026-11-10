import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";
import { latestTotalsByPiece, type MetricRow, type MetricTotals } from "./catalog";

export type Piece = Tables<"content_pieces">;
export type Metric = Tables<"content_metrics">;

export async function contentSession() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  return supabase;
}

/** Todas las piezas, ordenadas como en el tablero. */
export async function getPieces(): Promise<Piece[]> {
  const supabase = await contentSession();
  const { data } = await supabase
    .from("content_pieces")
    .select("*")
    .order("position", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(1000);
  return data ?? [];
}

export interface LinkedTransaction {
  id: string;
  booked_on: string;
  description: string;
  amount_cents: number;
}

export interface PieceDetail {
  piece: Piece;
  metrics: Metric[];
  transactions: LinkedTransaction[];
}

export async function getPiece(id: string): Promise<PieceDetail | null> {
  const supabase = await contentSession();
  const [{ data: piece }, { data: metrics }, { data: links }] = await Promise.all([
    supabase.from("content_pieces").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("content_metrics")
      .select("*")
      .eq("piece_id", id)
      .order("recorded_on", { ascending: false })
      .order("platform"),
    supabase
      .from("content_piece_transactions")
      .select("transactions (id, booked_on, description, amount_cents)")
      .eq("piece_id", id),
  ]);
  if (!piece) return null;
  const transactions = (links ?? [])
    .map((l) => l.transactions)
    .filter((t): t is LinkedTransaction => Boolean(t))
    .sort((a, b) => b.booked_on.localeCompare(a.booked_on));
  return { piece, metrics: metrics ?? [], transactions };
}

/** Movimientos recientes para enlazar a una pieza (ingresos primero). */
export async function getLinkableTransactions(): Promise<LinkedTransaction[]> {
  const supabase = await contentSession();
  const { data } = await supabase
    .from("transactions")
    .select("id, booked_on, description, amount_cents")
    .gt("amount_cents", 0)
    .order("booked_on", { ascending: false })
    .limit(60);
  return data ?? [];
}

export interface ContentStats {
  pieces: Pick<Piece, "id" | "title" | "status" | "format" | "platforms" | "publish_at">[];
  totals: Map<string, MetricTotals>;
  revenueByPiece: Map<string, number>;
  metricsByPlatform: Map<string, MetricTotals>;
}

/** Métricas (última foto por plataforma) e ingresos enlazados de todas las piezas. */
export async function getContentStats(): Promise<ContentStats> {
  const supabase = await contentSession();
  const [{ data: pieces }, { data: metrics }, { data: links }] = await Promise.all([
    supabase.from("content_pieces").select("id, title, status, format, platforms, publish_at").limit(1000),
    supabase
      .from("content_metrics")
      .select("piece_id, platform, recorded_on, views, likes, comments, shares, saves, followers_gained")
      .limit(5000),
    supabase.from("content_piece_transactions").select("piece_id, transactions (amount_cents)").limit(2000),
  ]);
  const rows = (metrics ?? []) as MetricRow[];
  const totals = latestTotalsByPiece(rows);

  // Por plataforma: misma regla (última foto por pieza y plataforma)
  const metricsByPlatform = new Map<string, MetricTotals>();
  for (const platform of new Set(rows.map((r) => r.platform))) {
    const perPiece = latestTotalsByPiece(rows.filter((r) => r.platform === platform));
    const sum = { views: 0, likes: 0, comments: 0, shares: 0, saves: 0, followers_gained: 0 };
    for (const t of perPiece.values()) {
      sum.views += t.views;
      sum.likes += t.likes;
      sum.comments += t.comments;
      sum.shares += t.shares;
      sum.saves += t.saves;
      sum.followers_gained += t.followers_gained;
    }
    metricsByPlatform.set(platform, sum);
  }

  const revenueByPiece = new Map<string, number>();
  for (const link of links ?? []) {
    const cents = link.transactions?.amount_cents ?? 0;
    revenueByPiece.set(link.piece_id, (revenueByPiece.get(link.piece_id) ?? 0) + cents);
  }

  return { pieces: pieces ?? [], totals, revenueByPiece, metricsByPlatform };
}
