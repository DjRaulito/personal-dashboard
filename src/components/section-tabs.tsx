"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { LinkPending } from "@/components/link-pending";

export interface SectionTab {
  href: string;
  label: string;
  /** Solo activa en su ruta exacta (la portada de la sección). */
  exact?: boolean;
  /** Otras rutas que también la marcan como activa. */
  also?: string[];
  /** Aviso numérico (por ejemplo, resultados nuevos). */
  count?: number;
}

const matches = (prefix: string, pathname: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);

export function tabIsActive(tab: SectionTab, pathname: string): boolean {
  const also = (tab.also ?? []).some((p) => matches(p, pathname));
  if (tab.exact) return pathname === tab.href || also;
  return also || matches(tab.href, pathname);
}

/** Control segmentado con las subsecciones de una pantalla (Resumen · Posiciones · Rentabilidad…). */
export function SectionTabs({ label, tabs }: { label: string; tabs: SectionTab[] }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label={label}
      className="relative -mx-4 max-w-[calc(100%+2rem)] overflow-x-auto px-4 sm:mx-0 sm:max-w-full sm:px-0"
    >
      <ul className="bg-surface border-border flex w-max gap-1 rounded-full border p-1">
        {tabs.map((tab) => {
          const active = tabIsActive(tab, pathname);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "relative flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium whitespace-nowrap transition-[background-color,color,transform] duration-150 active:scale-95 motion-reduce:active:scale-100",
                  active ? "bg-selected text-on-selected" : "text-muted hover:text-text",
                )}
              >
                {tab.label}
                {(tab.count ?? 0) > 0 && (
                  <span className="bg-attention text-ink rounded-full px-1.5 text-xs font-bold tabular-nums">
                    {tab.count}
                    <span className="sr-only"> nuevos</span>
                  </span>
                )}
                {!active && <LinkPending className="absolute top-1 right-2" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
