import type { Metadata } from "next";
import { Importer } from "@/components/finance/importer";
import { Tile, TileTitle } from "@/components/ui";
import { getAccounts } from "@/lib/finance/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Importar · Finanzas" };

export default async function ImportPage() {
  const supabase = await createClient();
  const [accounts, { data: profiles }] = await Promise.all([
    getAccounts(),
    supabase.from("import_profiles").select("name, account_id, mapping").order("updated_at", { ascending: false }),
  ]);

  return (
    <Tile>
      <TileTitle>Importar extracto</TileTitle>
      <p className="text-muted mt-2 max-w-2xl text-sm">
        Descarga el extracto de tu banco en CSV o Excel. La primera vez eliges qué columna es cada cosa; se guarda como
        plantilla para la próxima. Los movimientos que ya existan no se duplican.
      </p>
      <div className="mt-5">
        <Importer
          accounts={accounts.filter((a) => !a.archived).map((a) => ({ id: a.id, name: a.name, currency: a.currency }))}
          profiles={profiles ?? []}
        />
      </div>
    </Tile>
  );
}
