import type { Metadata } from "next";
import { Download } from "lucide-react";
import { DeleteModuleData } from "@/components/settings-delete-data";
import { buttonClass, Tile, TileTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Datos · Ajustes" };

export default function DataSettingsPage() {
  return (
    <>
      <Tile>
        <TileTitle>Exportar</TileTitle>
        <p className="text-muted mt-1 text-sm">
          Todos tus datos en un archivo JSON: finanzas, inversiones, nutrición, armario, cerebro e inmuebles. Las fotos
          del armario no van dentro (solo sus rutas) y tampoco los tokens de acceso. Guárdalo fuera del repositorio.
        </p>
        <a href="/api/export" download className={`${buttonClass.secondary} mt-4`}>
          <Download aria-hidden="true" className="h-4 w-4" /> Descargar JSON
        </a>
      </Tile>
      <Tile>
        <TileTitle dot="bg-expense">Borrar datos de un módulo</TileTitle>
        <p className="text-muted mt-1 mb-4 text-sm">
          Borra todo lo de ese módulo y no se puede deshacer. Exporta antes si quieres conservar una copia.
        </p>
        <DeleteModuleData />
      </Tile>
    </>
  );
}
