"use client";

import { useLinkStatus } from "next/link";

/** Punto que late mientras se carga la página del enlace (va dentro de un <Link>). */
export function LinkPending({ className = "" }: { className?: string }) {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden="true"
      className={`bg-finance inline-block h-1.5 w-1.5 shrink-0 rounded-full transition-opacity duration-150 motion-safe:animate-pulse ${pending ? "opacity-100" : "opacity-0"} ${className}`}
    />
  );
}
