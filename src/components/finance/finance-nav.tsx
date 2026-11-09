"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";

const TABS = [
  { href: "/finanzas", label: "Resumen" },
  { href: "/finanzas/movimientos", label: "Movimientos" },
  { href: "/finanzas/cuentas", label: "Cuentas" },
  { href: "/finanzas/importar", label: "Importar" },
  { href: "/finanzas/categorias", label: "Categorías y reglas" },
];

export function FinanceNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Finanzas" className="relative -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="bg-surface border-border flex w-max gap-1 rounded-full border p-1">
        {TABS.map((tab) => {
          const active = tab.href === "/finanzas" ? pathname === tab.href : pathname.startsWith(tab.href);
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
