import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import type { BrainNode } from "./graph";

export type TokenRow = Pick<
  Database["public"]["Tables"]["brain_tokens"]["Row"],
  "id" | "label" | "created_at" | "last_used_at"
>;

export interface BrainData {
  nodes: BrainNode[];
  links: { a: string; b: string }[];
  tokens: TokenRow[];
  total: number;
}

/** Recuerdos (los más recientes que caben en la red), sus conexiones y los tokens. */
export async function getBrain(limit: number): Promise<BrainData> {
  const supabase = await createClient();
  const [mem, links, tokens] = await Promise.all([
    supabase
      .from("brain_memories")
      .select("id, title, content, tags, source, updated_at", { count: "exact" })
      .order("updated_at", { ascending: false })
      .limit(limit),
    supabase.from("brain_links").select("a, b"),
    supabase
      .from("brain_tokens")
      .select("id, label, created_at, last_used_at")
      .order("created_at", { ascending: false }),
  ]);
  if (mem.error) throw mem.error;
  return {
    nodes: mem.data ?? [],
    links: links.data ?? [],
    tokens: tokens.data ?? [],
    total: mem.count ?? mem.data?.length ?? 0,
  };
}
