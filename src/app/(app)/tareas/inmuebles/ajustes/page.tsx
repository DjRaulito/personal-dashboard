import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { CopyButton } from "@/components/properties/listing-controls";
import { SettingsForm } from "@/components/properties/settings-form";
import { BackLink, Tile, TileTitle } from "@/components/ui";
import { getPropertySettings } from "@/lib/realestate/server";
import { taskPrompt } from "@/lib/realestate/task-prompt";

export const metadata: Metadata = { title: "Criterios · Inmuebles" };
export const dynamic = "force-dynamic";

function Code({ children }: { children: string }) {
  return (
    <pre className="bg-surface-2 rounded-inner max-h-96 overflow-auto p-3 text-xs leading-relaxed break-words whitespace-pre-wrap">
      <code>{children}</code>
    </pre>
  );
}

export default async function PropertySettingsPage() {
  const [settings, h] = await Promise.all([getPropertySettings(), headers()]);
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${proto}://${host}`;
  const endpoint = `${origin}/api/brain/mcp`;
  const prompt = taskPrompt(origin);

  return (
    <>
      <BackLink href="/tareas/inmuebles">Inmuebles</BackLink>

      <SettingsForm settings={settings} />

      <Tile>
        <TileTitle dot="bg-content">Conectar la tarea de Cowork</TileTitle>
        <ol className="mt-4 flex list-decimal flex-col gap-3 pl-5 text-sm">
          <li>
            <span className="font-medium">Si ya tienes el conector del cerebro en Claude</span>, no hace falta nada más:
            ese mismo conector incluye las herramientas de inmuebles. Si no lo tienes, crea un token en{" "}
            <Link href="/cerebro" className="text-content hover:underline">
              IA → Cerebro
            </Link>{" "}
            y añade en Claude un conector personalizado con esta dirección, cambiando{" "}
            <code className="bg-surface-2 rounded px-1 text-xs">TU_TOKEN</code> por el token:
            <div className="mt-2">
              <Code>{`${endpoint}?token=TU_TOKEN`}</Code>
            </div>
            <p className="text-muted mt-1 text-xs">
              Si tu cliente permite cabeceras, usa la dirección sin <code>?token=</code> y la cabecera{" "}
              <code>Authorization: Bearer TU_TOKEN</code>.
            </p>
          </li>
          <li>
            En tu tarea programada de Cowork, activa ese conector y sustituye el texto por este:
            <div className="mt-2 flex flex-col gap-2">
              <Code>{prompt}</Code>
              <div>
                <CopyButton text={prompt} label="Copiar texto de la tarea" />
              </div>
            </div>
          </li>
        </ol>
        <p className="text-muted mt-4 text-xs">
          Quien tenga el token puede leer y escribir tus pisos y tu memoria: trátalo como una contraseña.
        </p>
      </Tile>
    </>
  );
}
