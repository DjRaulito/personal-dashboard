import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { SalaryForm } from "@/components/finance/salary-form";
import { Tile, TileTitle } from "@/components/ui";
import { STATEMENTS_FOLDER } from "@/lib/finance/statements-sync";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Finanzas · Ajustes" };

const LINKS = [
  {
    href: "/ajustes/finanzas/cuentas",
    title: "Cuentas",
    text: "Bancos, tarjetas, efectivo y casas de apuestas, con su saldo.",
  },
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

const DAY = new Intl.DateTimeFormat("es-ES", { dateStyle: "long", timeZone: "Europe/Madrid" });

export default async function FinanceSettingsPage() {
  const supabase = await createClient();
  const [{ data: profile }, { data: files }] = await Promise.all([
    supabase.from("profiles").select("monthly_salary_cents").maybeSingle(),
    supabase
      .from("statement_files")
      .select("period, processed_at")
      .order("processed_at", { ascending: false })
      .limit(200),
  ]);
  const periods = (files ?? [])
    .map((f) => f.period)
    .filter((p): p is string => Boolean(p))
    .sort();

  return (
    <>
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

      <Tile>
        <TileTitle>Extractos de Drive</TileTitle>
        <p className="text-muted mt-2 max-w-2xl text-sm">
          El botón «Sincronizar extractos» de Gastos lee los PDF del BBVA de tu carpeta «{STATEMENTS_FOLDER}» de Google
          Drive, abre solo los nuevos y añade sus movimientos a la cuenta del BBVA, con categoría por tus reglas y sin
          duplicar. Usa tu propia cuenta de Google: la primera vez, conéctala en Ajustes → Conexiones para dar permiso
          de lectura de Drive.
        </p>
        <p className="mt-3 text-sm">
          {periods.length
            ? `${periods.length} extractos leídos, de ${periods[0]} a ${periods.at(-1)}. Última lectura: ${DAY.format(new Date(files![0].processed_at))}.`
            : "Aún no se ha leído ningún extracto."}
        </p>
      </Tile>

      <Tile>
        <TileTitle>Salario de respaldo</TileTitle>
        <p className="text-muted mt-2 max-w-2xl text-sm">
          Tu salario sale solo de los extractos (los abonos «ABONO DE NOMINA» van a la categoría Nómina). Este importe
          solo se usa en el mes en curso mientras no haya llegado la nómina, para que la comparación con los gastos no
          salga vacía.
        </p>
        <div className="mt-4 max-w-sm">
          <SalaryForm cents={profile?.monthly_salary_cents ?? null} />
        </div>
      </Tile>
    </>
  );
}
