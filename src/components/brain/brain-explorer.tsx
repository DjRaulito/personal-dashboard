"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { deleteMemory, saveMemory, setLink } from "@/app/(app)/ia/cerebro/actions";
import { BrainGraph } from "@/components/brain/brain-graph";
import { buttonClass, EmptyState, Field, FormMessage, inputClass } from "@/components/ui";
import { buildEdges, matchesQuery, neighbors, nodeColor, type BrainNode } from "@/lib/brain/graph";

interface Props {
  nodes: BrainNode[];
  links: { a: string; b: string }[];
  total: number;
}

const fmt = new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Madrid" });

export function BrainExplorer({ nodes, links, total }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<"new" | "edit" | null>(null);

  const edges = useMemo(() => buildEdges(nodes, links), [nodes, links]);
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const selected = selectedId ? (byId.get(selectedId) ?? null) : null;
  const matches = useMemo(() => nodes.filter((n) => matchesQuery(n, query)), [nodes, query]);
  const matchIds = query.trim() ? new Set(matches.map((n) => n.id)) : null;

  const select = (id: string | null) => {
    setSelectedId(id);
    setEditing(null);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar en la memoria…"
            aria-label="Buscar en la memoria"
            className={`${inputClass} max-w-xs`}
          />
          <button
            type="button"
            className={buttonClass.primary}
            onClick={() => {
              setSelectedId(null);
              setEditing("new");
            }}
          >
            Nuevo recuerdo
          </button>
          <p className="text-muted ml-auto text-xs" aria-live="polite">
            {nodes.length} recuerdos · {edges.length} conexiones
            {total > nodes.length && ` · se muestran los ${nodes.length} más recientes de ${total}`}
          </p>
        </div>
        {nodes.length ? (
          <BrainGraph nodes={nodes} edges={edges} selectedId={selectedId} matchIds={matchIds} onSelect={select} />
        ) : (
          <EmptyState>
            Aún no hay recuerdos. Crea el primero o conecta una IA con el token de abajo y empezará a guardar.
          </EmptyState>
        )}
        <p className="text-muted text-xs">
          Cada punto es un recuerdo. Línea continua: conexión directa. Línea de puntos: comparten etiquetas. Arrastra
          para moverlos, pulsa para abrirlos.
        </p>
      </div>

      <aside aria-label="Recuerdo" className="border-border rounded-inner flex min-w-0 flex-col gap-3 border p-4">
        {editing ? (
          <MemoryForm
            key={editing === "edit" ? selected?.id : "new"}
            memory={editing === "edit" ? selected : null}
            onDone={(id) => {
              setEditing(null);
              if (id) setSelectedId(id);
            }}
            onCancel={() => setEditing(null)}
          />
        ) : selected ? (
          <MemoryDetail
            memory={selected}
            nodes={nodes}
            edges={edges}
            links={links}
            onSelect={select}
            onEdit={() => setEditing("edit")}
          />
        ) : (
          <MemoryList items={matches} onSelect={select} />
        )}
      </aside>
    </div>
  );
}

function Tags({ tags }: { tags: string[] }) {
  if (!tags.length) return null;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {tags.map((t) => (
        <li key={t} className="bg-surface-2 rounded-full px-2.5 py-0.5 text-xs">
          {t}
        </li>
      ))}
    </ul>
  );
}

function MemoryList({ items, onSelect }: { items: BrainNode[]; onSelect: (id: string) => void }) {
  if (!items.length) return <EmptyState>Nada coincide.</EmptyState>;
  return (
    <>
      <h3 className="text-muted text-sm">Recuerdos</h3>
      <ul className="-mx-1 flex max-h-96 flex-col overflow-y-auto">
        {items.map((n) => (
          <li key={n.id}>
            <button
              type="button"
              onClick={() => onSelect(n.id)}
              className="hover:bg-surface-2 rounded-inner flex w-full items-center gap-2.5 px-2 py-2 text-left text-sm transition-colors duration-150"
            >
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: nodeColor(n.tags) }}
              />
              <span className="truncate">{n.title}</span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

function MemoryDetail({
  memory,
  nodes,
  edges,
  links,
  onSelect,
  onEdit,
}: {
  memory: BrainNode;
  nodes: BrainNode[];
  edges: ReturnType<typeof buildEdges>;
  links: { a: string; b: string }[];
  onSelect: (id: string | null) => void;
  onEdit: () => void;
}) {
  const [pending, start] = useTransition();
  const [target, setTarget] = useState("");
  const near = neighbors(memory.id, edges);
  const explicit = new Set(links.flatMap((l) => (l.a === memory.id ? [l.b] : l.b === memory.id ? [l.a] : [])));
  const candidates = nodes.filter((n) => n.id !== memory.id && !explicit.has(n.id));

  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display text-lg leading-tight font-bold">{memory.title}</h3>
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={buttonClass.secondary}
          aria-label="Cerrar recuerdo"
        >
          Cerrar
        </button>
      </div>
      <p className="text-sm whitespace-pre-wrap">{memory.content}</p>
      <Tags tags={memory.tags} />
      <p className="text-muted text-xs">
        {memory.source === "manual" ? "Escrito a mano" : `Guardado por ${memory.source}`} ·{" "}
        {fmt.format(new Date(memory.updated_at))}
      </p>

      <div className="flex flex-col gap-1.5">
        <h4 className="text-muted text-sm">Conexiones ({near.length})</h4>
        {near.length ? (
          <ul className="flex flex-col">
            {near.map((n) => {
              const other = nodes.find((x) => x.id === n.id);
              if (!other) return null;
              return (
                <li key={n.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onSelect(n.id)}
                    className="hover:bg-surface-2 rounded-inner flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left text-sm transition-colors duration-150"
                  >
                    <span
                      aria-hidden="true"
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: nodeColor(other.tags) }}
                    />
                    <span className="truncate">{other.title}</span>
                    <span className="text-muted ml-auto shrink-0 text-xs">
                      {n.kind === "link" ? "directa" : "etiquetas"}
                    </span>
                  </button>
                  {n.kind === "link" && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => start(() => setLink(memory.id, n.id, false))}
                      className="text-muted hover:text-text rounded-full px-2 py-1 text-xs"
                      aria-label={`Quitar conexión con ${other.title}`}
                    >
                      Quitar
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-muted text-sm">Sin conexiones todavía.</p>
        )}
        {candidates.length > 0 && (
          <div className="mt-1 flex gap-2">
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              aria-label="Conectar con otro recuerdo"
              className={inputClass}
            >
              <option value="">Conectar con…</option>
              {candidates.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.title}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!target || pending}
              onClick={() =>
                start(async () => {
                  await setLink(memory.id, target, true);
                  setTarget("");
                })
              }
              className={buttonClass.secondary}
            >
              Unir
            </button>
          </div>
        )}
      </div>

      <div className="mt-1 flex gap-2">
        <button type="button" onClick={onEdit} className={buttonClass.secondary}>
          Editar
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (confirm(`¿Olvidar «${memory.title}»?`)) {
              start(async () => {
                await deleteMemory(memory.id);
                onSelect(null);
              });
            }
          }}
          className={buttonClass.danger}
        >
          Olvidar
        </button>
      </div>
    </>
  );
}

function MemoryForm({
  memory,
  onDone,
  onCancel,
}: {
  memory: BrainNode | null;
  onDone: (id?: string) => void;
  onCancel: () => void;
}) {
  const [state, action, pending] = useActionState(
    async (prev: Awaited<ReturnType<typeof saveMemory>>, formData: FormData) => {
      const next = await saveMemory(prev, formData);
      if (next.ok) onDone(next.savedId);
      return next;
    },
    { ok: false },
  );
  return (
    <form action={action} className="flex flex-col gap-3">
      {memory && <input type="hidden" name="id" value={memory.id} />}
      <Field label="Título" error={state.errors?.title}>
        <input name="title" defaultValue={memory?.title} maxLength={80} required className={inputClass} />
      </Field>
      <Field label="Recuerdo" error={state.errors?.content}>
        <textarea
          name="content"
          defaultValue={memory?.content}
          rows={6}
          maxLength={2000}
          required
          className={`${inputClass} resize-y`}
        />
      </Field>
      <Field label="Etiquetas (separadas por comas)" error={state.errors?.tags}>
        <input name="tags" defaultValue={memory?.tags.join(", ")} className={inputClass} />
      </Field>
      <FormMessage state={state} />
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={buttonClass.primary}>
          {pending ? "Guardando…" : "Guardar"}
        </button>
        <button type="button" onClick={onCancel} className={buttonClass.secondary}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
