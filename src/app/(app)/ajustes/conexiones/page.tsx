import type { Metadata } from "next";
import { headers } from "next/headers";
import { clsx } from "clsx";
import { TokenManager } from "@/components/brain/token-manager";
import { AiKeysManager, GoogleButtons } from "@/components/settings-connections";
import { Tile, TileTitle } from "@/components/ui";
import { aiProviderNames } from "@/lib/ai/llm";
import type { ProviderId } from "@/lib/ai/providers";
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
  const [{ data: google }, tokens, h, { data: keys }, providers, { data: admin }] = await Promise.all([
    supabase.from("integrations").select("account_email, scopes, updated_at").eq("provider", "google").maybeSingle(),
    getBrainTokens(),
    headers(),
    supabase.from("user_api_keys").select("provider, hint"),
    aiProviderNames(),
    supabase.rpc("is_admin"),
  ]);
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const endpoint = `${proto}://${host}/api/brain/mcp`;
  const configured = Boolean(getGoogleConfig());
  const saved = Object.fromEntries((keys ?? []).map((k) => [k.provider, k.hint])) as Partial<
    Record<ProviderId, string>
  >;
  const scopes = google?.scopes ?? [];
  const grants = [
    scopes.some((s) => s.includes("calendar")) && "calendario",
    scopes.some((s) => s.includes("spreadsheets")) && "hojas",
    scopes.some((s) => s.includes("drive")) && "Drive",
  ].filter(Boolean);

  return (
    <>
      <Tile>
        <TileTitle>Google</TileTitle>
        <p className="text-muted mt-1 text-sm">
          Para leer tu calendario, la hoja de la nutricionista y los extractos de Drive. Los permisos se dan una sola
          vez aquí; al entrar en la app ya no se vuelven a pedir.
        </p>
        <ul className="mt-4 flex flex-col gap-2">
          <Status
            name="Cuenta"
            ok={configured && Boolean(google)}
            detail={
              !configured
                ? "Sin configurar en el servidor"
                : google
                  ? `Conectada${google.account_email ? ` · ${google.account_email}` : ""}${grants.length ? ` · ${grants.join(", ")}` : ""}`
                  : "Sin conectar"
            }
          />
        </ul>
        {configured && (
          <div className="mt-3">
            <GoogleButtons connected={Boolean(google)} />
          </div>
        )}
      </Tile>

      <Tile>
        <TileTitle dot="bg-content">IA</TileTitle>
        <p className="text-muted mt-1 text-sm">
          Tus claves gratuitas para leer tickets y platos, el armario y el asistente. Se guardan cifradas y no se
          vuelven a enseñar. Con varias, si una se queda sin cuota se pasa a la siguiente.
        </p>
        <p className={clsx("mt-3 text-sm", providers.length ? "text-muted" : "text-attention")}>
          {providers.length
            ? `En uso: ${providers.join(" → ")}${admin ? " (con las del servidor de respaldo)" : ""}`
            : "! Sin claves: añade al menos una para usar la IA."}
        </p>
        <div className="mt-4">
          <AiKeysManager saved={saved} />
        </div>
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
