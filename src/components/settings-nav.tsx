"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { LinkPending } from "@/components/link-pending";
import { activeSection, SETTINGS_SECTIONS } from "@/lib/settings/sections";

/**
 * Lista de secciones de Ajustes. En escritorio va siempre a la izquierda; en móvil es la
 * portada (lista → detalle, como los ajustes del móvil) y dentro de una sección solo queda
 * el enlace para volver.
 */
export function SettingsNav() {
  const pathname = usePathname();
  const active = activeSection(pathname);
  return (
    <>
      {active && (
        <Link
          href="/ajustes"
          className="text-muted hover:text-text inline-flex items-center gap-1 self-start text-sm md:hidden"
        >
          <ChevronLeft aria-hidden="true" className="h-4 w-4" /> Ajustes
        </Link>
      )}
      <nav aria-label="Secciones de ajustes" className={clsx(active && "hidden md:block")}>
        <ul className="border-border bg-surface rounded-tile flex flex-col overflow-hidden border md:sticky md:top-6">
          {SETTINGS_SECTIONS.map((s) => {
            const current = s.slug === active;
            return (
              <li key={s.slug} className="border-border border-t first:border-t-0">
                <Link
                  href={`/ajustes/${s.slug}`}
                  aria-current={current ? "page" : undefined}
                  className={clsx(
                    "focus-visible:outline-content relative flex items-center gap-3 px-5 py-3.5 transition-colors duration-150 focus-visible:outline-2 focus-visible:-outline-offset-2",
                    current ? "bg-surface-2" : "hover:bg-surface-2",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className={clsx("block font-semibold", current && "text-finance")}>{s.title}</span>
                    <span className="text-muted block truncate text-sm md:hidden">{s.description}</span>
                  </span>
                  <LinkPending />
                  <ChevronRight aria-hidden="true" className="text-muted h-4 w-4 md:hidden" />
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
