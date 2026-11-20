import { NextResponse } from "next/server";
import { EXPORT_TABLES } from "@/lib/settings/data";
import { createClient } from "@/lib/supabase/server";

// Exporta todos los datos del usuario a un JSON (Ajustes → Datos). RLS limita cada tabla a
// sus propias filas; las fotos del armario no van dentro, solo sus rutas.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PAGE = 1000;

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });

  const tables: Record<string, unknown[]> = {};
  for (const table of EXPORT_TABLES) {
    const rows: unknown[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .range(from, from + PAGE - 1);
      if (error) return NextResponse.json({ error: `No se pudo leer ${table}` }, { status: 500 });
      rows.push(...(data ?? []));
      if (!data || data.length < PAGE) break;
    }
    tables[table] = rows;
  }

  const day = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify({ exported_at: new Date().toISOString(), tables }, null, 1), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="dashboard-${day}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
