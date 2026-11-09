import Link from "next/link";
import { clsx } from "clsx";

// Piezas de formulario comunes (ver DESIGN.md)
export const inputClass =
  "bg-surface-2 border-border-strong rounded-inner focus-visible:outline-content w-full border px-3.5 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50";

export const buttonClass = {
  primary:
    "bg-finance text-ink focus-visible:outline-text inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-[transform,filter] duration-150 hover:scale-[1.02] hover:brightness-105 active:scale-[0.96] active:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:hover:scale-100 motion-reduce:transition-none motion-reduce:hover:scale-100 motion-reduce:active:scale-100",
  secondary:
    "border-border-strong hover:bg-surface-2 active:bg-border focus-visible:outline-content inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-[background-color,transform] duration-150 active:scale-[0.96] focus-visible:outline-2 disabled:opacity-50 motion-reduce:active:scale-100",
  danger:
    "text-expense hover:bg-surface-2 active:bg-border focus-visible:outline-content inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-[background-color,transform] duration-150 active:scale-[0.96] focus-visible:outline-2 disabled:opacity-50 motion-reduce:active:scale-100",
};

export function Field({
  label,
  error,
  children,
  className,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={clsx("flex flex-col gap-1.5 text-sm", className)}>
      <span className="text-muted">{label}</span>
      {children}
      {error && <span className="text-attention text-xs">{error}</span>}
    </label>
  );
}

export function Tile({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={clsx("rounded-tile border-border bg-surface border p-6", className)}>{children}</section>;
}

export function TileTitle({ children, dot = "bg-finance" }: { children: React.ReactNode; dot?: string }) {
  return (
    <h2 className="flex items-center gap-3 font-semibold">
      <span aria-hidden="true" className={clsx("h-2.5 w-2.5 rounded-full", dot)} />
      {children}
    </h2>
  );
}

export function FormMessage({ state }: { state: { ok: boolean; message?: string } }) {
  if (!state.message) return null;
  return (
    <p
      role={state.ok ? "status" : "alert"}
      className={clsx("bg-surface-2 rounded-inner px-3.5 py-2.5 text-sm", state.ok ? "text-finance" : "text-attention")}
    >
      {state.message}
    </p>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="text-muted py-6 text-center text-sm">{children}</p>;
}

/** Enlace de vuelta a la sección anterior. */
export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-muted hover:text-text inline-flex items-center gap-1.5 self-start rounded-full py-1 text-sm transition-colors duration-150 active:opacity-70"
    >
      <span aria-hidden="true">←</span> {children}
    </Link>
  );
}

/** Bloque gris animado mientras carga una pantalla. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={clsx("bg-surface-2 rounded-inner animate-pulse motion-reduce:animate-none", className)}
    />
  );
}
