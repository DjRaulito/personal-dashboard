import type { Metadata } from "next";
import Link from "next/link";
import { setArchived } from "@/app/(app)/tareas/actions";
import { CopyButton } from "@/components/properties/listing-controls";
import { buttonClass, EmptyState, Tile, TileTitle } from "@/components/ui";
import { taskParagraph } from "@/lib/tasks/prompt";
import { getTasks } from "@/lib/tasks/server";

export const metadata: Metadata = { title: "Tareas · Ajustes" };

export default async function TaskSettingsPage() {
  const tasks = await getTasks();
  const paragraph = taskParagraph();
  return (
    <>
      <Tile>
        <TileTitle dot="bg-content">Párrafo para tus tareas programadas</TileTitle>
        <p className="text-muted mt-1 text-sm">
          Añádelo al final de cualquier tarea programada de Claude (con el conector del Cerebro activado). En su primera
          ejecución se registra sola y aparece su pestaña en Tareas, con su pantalla según los datos que guarde. El
          conector y su token están en{" "}
          <Link href="/ajustes/conexiones" className="text-content hover:underline">
            Conexiones
          </Link>
          .
        </p>
        <pre className="bg-surface-2 rounded-inner mt-4 max-h-96 overflow-auto p-3 text-xs leading-relaxed break-words whitespace-pre-wrap">
          <code>{paragraph}</code>
        </pre>
        <div className="mt-3">
          <CopyButton text={paragraph} label="Copiar párrafo" />
        </div>
      </Tile>

      <Tile>
        <TileTitle dot="bg-content">Tus tareas</TileTitle>
        <p className="text-muted mt-1 text-sm">
          Archivar quita la pestaña sin borrar sus resultados; si la tarea vuelve a registrarse, reaparece.
        </p>
        {tasks.length === 0 ? (
          <EmptyState>Aún no se ha registrado ninguna tarea.</EmptyState>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {tasks.map((t) => (
              <li
                key={t.id}
                className="bg-surface-2 rounded-inner flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <span className="min-w-0">
                  <Link href={`/tareas/${t.slug}`} className="block truncate font-medium hover:underline">
                    {t.name}
                  </Link>
                  <span className="text-muted block text-xs">
                    {t.archived ? "Archivada" : t.schedule ? `Corre ${t.schedule}` : t.slug}
                  </span>
                </span>
                <form action={setArchived.bind(null, t.slug, !t.archived)}>
                  <button type="submit" className={buttonClass.secondary}>
                    {t.archived ? "Desarchivar" : "Archivar"}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Tile>
    </>
  );
}
