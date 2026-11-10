"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { refreshAgents } from "@/app/(app)/ia/agentes/actions";
import { createClient } from "@/lib/supabase/client";

const POLL_MS = 15000;

/**
 * Tablero en directo: escucha los cambios de ejecuciones, registros y acciones (Supabase Realtime)
 * y recarga los datos del servidor. Mientras haya trabajo en marcha, además consulta GitHub
 * (Claude Code) y arranca lo que esté en cola.
 */
export function LiveRefresh({ active }: { active: boolean }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const refresh = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 400);
    };
    const channel = supabase
      .channel("agentes")
      .on("postgres_changes", { event: "*", schema: "public", table: "agent_runs" }, refresh)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "agent_logs" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "agent_actions" }, refresh)
      .subscribe();
    return () => {
      if (timer.current) clearTimeout(timer.current);
      void supabase.removeChannel(channel);
    };
  }, [router]);

  useEffect(() => {
    if (!active) return;
    let stopped = false;
    const tick = async () => {
      try {
        await refreshAgents();
      } catch {
        // sin conexión: se reintenta en la siguiente vuelta
      }
      if (!stopped) router.refresh();
    };
    void tick();
    const interval = setInterval(tick, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [active, router]);

  return null;
}
