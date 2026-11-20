import type { Metadata } from "next";
import Link from "next/link";
import { NewAssetForm } from "@/components/investments/new-asset-form";
import { clsx } from "clsx";
import { BackLink, buttonClass, Tile, TileTitle } from "@/components/ui";
import { getPortfolio } from "@/lib/investments/server";
import { KIND_LABELS } from "@/lib/investments/view";

export const metadata: Metadata = { title: "Activos · Inversiones" };

export default async function AssetsPage() {
  const pf = await getPortfolio();
  return (
    <>
      <BackLink href="/finanzas/inversiones">Inversiones</BackLink>
      <Link href="/finanzas/inversiones/importar" className={clsx(buttonClass.secondary, "self-start")}>
        Importar cartera (Investing y brokers)
      </Link>
      <Tile>
        <TileTitle>Añadir activo a mano</TileTitle>
        <p className="text-muted mt-1 text-sm">
          Para planes de pensiones u otros productos que no vienen en las importaciones. Después añade sus aportaciones
          en Inversiones → Operaciones y su valor liquidativo en la ficha del activo.
        </p>
        <div className="mt-4">
          <NewAssetForm />
        </div>
      </Tile>
      <Tile>
        <TileTitle>Activos ({pf.assets.length})</TileTitle>
        <p className="text-muted mt-1 text-sm">
          Si un activo no tiene precio, entra y pon su símbolo de Yahoo Finance o añade el precio a mano.
        </p>
        <ul className="mt-4 flex flex-col">
          {pf.assets.map((a) => {
            const prices = pf.input.prices.get(a.id);
            const held = (pf.positions.get(a.id)?.quantity ?? 0) > 0;
            return (
              <li
                key={a.id}
                className="border-border flex flex-wrap items-center gap-x-3 gap-y-1 border-t py-2 text-sm"
              >
                <Link
                  href={`/finanzas/inversiones/activo/${a.id}`}
                  className={`min-w-0 flex-1 truncate hover:underline ${held ? "font-medium" : "text-muted"}`}
                >
                  {a.name}
                </Link>
                <span className="text-muted text-xs">{KIND_LABELS[a.kind]}</span>
                <span className="text-muted w-32 truncate text-xs">
                  {a.price_source === "manual" ? "precio a mano" : (a.price_symbol ?? "sin símbolo")}
                </span>
                <span className={`w-28 text-right text-xs ${prices?.length ? "text-muted" : "text-attention"}`}>
                  {prices?.length ? `${prices.length} precios` : "sin precios"}
                </span>
              </li>
            );
          })}
        </ul>
      </Tile>
    </>
  );
}
