import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export const metadata: Metadata = { title: "Finanzas · Ajustes" };

const LINKS = [
  { href: "/ajustes/finanzas/cuentas", title: "Cuentas", text: "Bancos, tarjetas, efectivo y su saldo inicial." },
  {
    href: "/ajustes/finanzas/categorias",
    title: "Categorías y reglas",
    text: "Cómo se clasifican solos tus gastos e ingresos.",
  },
  {
    href: "/ajustes/finanzas/importar",
    title: "Importar extracto",
    text: "CSV o Excel de tu banco, con plantilla por banco y sin duplicados.",
  },
];

export default function FinanceSettingsPage() {
  return (
    <ul className="border-border bg-surface rounded-tile flex flex-col overflow-hidden border">
      {LINKS.map((l) => (
        <li key={l.href} className="border-border border-t first:border-t-0">
          <Link href={l.href} className="hover:bg-surface-2 flex items-center gap-3 px-6 py-4 transition-colors">
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{l.title}</span>
              <span className="text-muted block text-sm">{l.text}</span>
            </span>
            <ChevronRight aria-hidden="true" className="text-muted h-4 w-4" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
