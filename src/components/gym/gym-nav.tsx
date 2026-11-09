"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { LinkPending } from "@/components/link-pending";

const TABS = [
  {
    href: "/gimnasio",
    label: "Resumen",
    match: (p: string) => p === "/gimnasio" || p.startsWith("/gimnasio/entreno"),
  },
  { href: "/gimnasio/ejercicios", label: "Ejercicios", match: (p: string) => p.startsWith("/gimnasio/ejercicios") },
  { href: "/gimnasio/cuerpo", label: "Cuerpo", match: (p: string) => p.startsWith("/gimnasio/cuerpo") },
  { href: "/gimnasio/importar", label: "Importar", match: (p: string) => p.startsWith("/gimnasio/importar") },
];

export function GymNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Gimnasio" className="relative -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
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
                  active ? "bg-gym text-ink" : "text-muted hover:text-text",
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
