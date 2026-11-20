import type { Metadata } from "next";
import { headers } from "next/headers";
import { clsx } from "clsx";
import { TokenManager } from "@/components/brain/token-manager";
import { Tile, TileTitle } from "@/components/ui";
import { aiProviderNames } from "@/lib/ai/llm";
import { getBrainTokens } from "@/lib/brain/server";
import { getGoogleConfig } from "@/lib/env.server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Conexiones · Ajustes" };
export const dynamic = "force-dynamic";

function Status({ name, ok, detail }: { name: string; ok: boolean; detail: string }) {
  return (
    <li className="bg-surface-2 rounded-inner flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm">
      <span className="font-semibold">{name}</span>
      <span className={clsx("ml-auto text-right", ok ? "text-muted" : "text-attention")}>
        {/* El estado también va en palabras: el color solo lo refuerza */}
        {ok ? "✓ " : "! "}
        {detail}
      </span>
    </li>
  );
}

export default async function ConnectionsPage() {
  const supabase = await createClient();
  const [{ data: google }, tokens, h] = await Promise.all([
    supabase.from("integrations").select("account_email, updated_at").eq("provider", "google").maybeSingle(),
    getBrainTokens(),
    headers(),
  ]);
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const endpoint = `${proto}://${host}/api/brain/mcp`;
  const providers = aiProviderNames();

  return (
    <>
      <Tile>
        <TileTitle>Servicios</TileTitle>
        <ul className="mt-4 flex flex-col gap-2">
          <Status
            name="Google (calendario y hojas)"
            ok={Boolean(getGoogleConfig() && google)}
            detail={
              !getGoogleConfig()
                ? "Sin configurar en el servidor"
                : google
                  ? `Conectado${google.account_email ? ` · ${google.account_email}` : ""}`
                  : "Sin conectar: vuelve a entrar con Google"
            }
          />
          <Status
            name="IA"
            ok={providers.length > 0}
            detail={providers.length ? providers.join(" → ") : "Sin claves: añade GEMINI_API_KEY en Vercel"}
          />
        </ul>
        <p className="text-muted mt-3 text-xs">
          Las claves viven en las variables de entorno de Vercel, nunca en la app ni en el repositorio.
        </p>
      </Tile>
      <Tile>
        <TileTitle dot="bg-content">Cerebro: acceso de tus IAs</TileTitle>
        <p className="text-muted mt-1 mb-5 text-sm">
          Un token por IA. Puedes revocarlo cuando quieras sin tocar el resto.
        </p>
        <TokenManager endpoint={endpoint} tokens={tokens} />
      </Tile>
    </>
  );
}
