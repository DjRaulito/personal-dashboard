import type { Metadata } from "next";
import Link from "next/link";
import { PortfolioImporter } from "@/components/investments/portfolio-importer";
import { Tile, TileTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Importar cartera · Inversiones" };

export default function ImportPortfolioPage() {
  return (
    <Tile>
      <Link href="/finanzas/inversiones" className="text-muted hover:text-text text-sm">
        ← Inversiones
      </Link>
      <div className="mt-3">
        <TileTitle>Importar cartera</TileTitle>
      </div>
      <p className="text-muted mt-2 max-w-3xl text-sm">
        Une la exportación de Investing con las operaciones de MyInvestor y MEXEM. Las acciones salen de las operaciones
        de los brokers; los fondos, de las órdenes (con el ISIN y el importe exactos); y lo que solo esté en Investing
        (por ejemplo otro broker), de sus lotes.
      </p>
      <div className="mt-5">
        <PortfolioImporter />
      </div>
    </Tile>
  );
}
