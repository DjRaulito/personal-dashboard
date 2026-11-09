import type { Metadata } from "next";
import { HevyImporter } from "@/components/gym/importer";
import { Tile, TileTitle } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Importar · Gimnasio" };

export default async function ImportPage() {
  const supabase = await createClient();
  const { count } = await supabase.from("gym_workouts").select("id", { count: "exact", head: true });
  return (
    <div className="grid gap-3.5 lg:grid-cols-5">
      <Tile className="lg:col-span-3">
        <TileTitle dot="bg-gym">Importar desde Hevy</TileTitle>
        <p className="text-muted mt-1 text-sm">
          {count ? `Tienes ${count} entrenos importados. ` : ""}Sube el CSV completo cada vez que quieras: los entrenos
          ya importados se actualizan y los nuevos se añaden.
        </p>
        <div className="mt-5">
          <HevyImporter hasWorkouts={(count ?? 0) > 0} />
        </div>
      </Tile>
      <Tile className="lg:col-span-2">
        <TileTitle>Cómo sacar el CSV</TileTitle>
        <ol className="text-muted mt-3 flex list-decimal flex-col gap-2 pl-5 text-sm">
          <li>Abre Hevy y ve a tu Perfil.</li>
          <li>Toca el engranaje de Ajustes.</li>
          <li>Entra en Exportar e importar datos → Exportar entrenos.</li>
          <li>Guarda el archivo .csv y súbelo aquí.</li>
        </ol>
        <p className="text-muted mt-4 text-sm">
          El archivo se lee en tu navegador; solo se guardan los entrenos en tu base de datos.
        </p>
      </Tile>
    </div>
  );
}
