"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { LinkPending } from "@/components/link-pending";

const TABS = [
  {
    href: "/contenido",
    label: "Tablero",
    match: (p: string) => p === "/contenido" || p.startsWith("/contenido/pieza"),
  },
  { href: "/contenido/ideas", label: "Ideas", match: (p: string) => p.startsWith("/contenido/ideas") },
  { href: "/contenido/calendario", label: "Calendario", match: (p: string) => p.startsWith("/contenido/calendario") },
  { href: "/contenido/metricas", label: "Métricas", match: (p: string) => p.startsWith("/contenido/metricas") },
];

export function ContentNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Contenido" className="relative -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="bg-surface border-border flex w-max gap-1 rounded-full border p-1">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "relative flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium whitespace-nowrap transition-[background-color,color,transform] duration-150 active:scale-95 motion-reduce:active:scale-100",
                  active ? "bg-content text-ink" : "text-muted hover:text-text",
                )}
              >
                {tab.label}
                {!active && <LinkPending className="absolute top-1 right-2" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
