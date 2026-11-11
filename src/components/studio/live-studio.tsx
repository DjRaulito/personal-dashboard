"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { refreshStudio } from "@/app/(app)/contenido/estudio/actions/videos";
import { createClient } from "@/lib/supabase/client";

const POLL_MS = 30000;

/**
 * El progreso llega en directo (Supabase Realtime sobre video_jobs). Mientras haya vídeos en marcha,
 * además se consulta GitHub cada 30 s por si el montaje se cayó sin avisar.
 */
export function LiveStudio({ active }: { active: boolean }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const refresh = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 500);
    };
    const channel = supabase
      .channel("studio-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "video_jobs" }, refresh)
      .subscribe();
    return () => {
      if (timer.current) clearTimeout(timer.current);
      void supabase.removeChannel(channel);
    };
  }, [router]);

  useEffect(() => {
    if (!active) return;
    const interval = setInterval(async () => {
      try {
        await refreshStudio();
      } catch {
        // sin conexión: siguiente vuelta
      }
      router.refresh();
    }, POLL_MS);
    return () => clearInterval(interval);
  }, [active, router]);

  return null;
}
