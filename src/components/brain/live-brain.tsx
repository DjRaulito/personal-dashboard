"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Recarga la red cuando cambian los recuerdos (p. ej. otra IA guarda uno por MCP). */
export function LiveBrain() {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const refresh = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 600);
    };
    const channel = supabase
      .channel("brain-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "brain_memories" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "brain_links" }, refresh)
      .subscribe();
    return () => {
      if (timer.current) clearTimeout(timer.current);
      void supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
