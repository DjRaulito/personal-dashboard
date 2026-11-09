"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";

const TABS = [
  { href: "/finanzas", label: "Patrimonio", match: (p: string) => p === "/finanzas" },
  { href: "/finanzas/inversiones", label: "Inversiones", match: (p: string) => p.startsWith("/finanzas/inversiones") },
  {
    href: "/finanzas/gastos",
    label: "Gastos",
    match: (p: string) =>
      ["/finanzas/gastos", "/finanzas/movimientos", "/finanzas/importar"].some((x) => p.startsWith(x)),
  },
  { href: "/finanzas/metricas", label: "Métricas", match: (p: string) => p.startsWith("/finanzas/metricas") },
  {
    href: "/finanzas/ajustes",
    label: "Ajustes",
    match: (p: string) =>
      ["/finanzas/ajustes", "/finanzas/cuentas", "/finanzas/categorias"].some((x) => p.startsWith(x)),
  },
];

export function FinanceNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Finanzas" className="relative -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="bg-surface border-border flex w-max gap-1 rounded-full border p-1">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "block rounded-full px-4 py-1.5 text-sm font-medium whitespace-nowrap transition-colors duration-200",
                  active ? "bg-finance text-ink" : "text-muted hover:text-text",
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
