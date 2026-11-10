"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  createLayout,
  neighbors,
  nodeColor,
  settleLayout,
  tickLayout,
  type BrainEdge,
  type BrainNode,
} from "@/lib/brain/graph";

const W = 800;
const H = 560;

interface Props {
  nodes: BrainNode[];
  edges: BrainEdge[];
  selectedId: string | null;
  /** Recuerdos que casan con la búsqueda; null si no se busca nada */
  matchIds: Set<string> | null;
  onSelect: (id: string | null) => void;
}

const short = (s: string) => (s.length > 24 ? `${s.slice(0, 23)}…` : s);

/**
 * Red de recuerdos: cada nodo es un recuerdo, las líneas son conexiones (continuas = hechas a mano
 * o por una IA, tenues = comparten etiquetas). Los nodos se arrastran y se pulsan para abrirlos.
 */
export function BrainGraph({ nodes, edges, selectedId, matchIds, onSelect }: Props) {
  const ids = useMemo(() => nodes.map((n) => n.id), [nodes]);
  const layout = useMemo(() => createLayout(ids, edges, W, H), [ids, edges]);
  const [, setFrame] = useState(0);
  const [hover, setHover] = useState<string | null>(null);
  const alpha = useRef(0);
  const raf = useRef<number | null>(null);
  const pinned = useRef(new Set<number>());
  const drag = useRef<{ index: number; moved: boolean; startX: number; startY: number } | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const reheatRef = useRef<() => void>(() => {});

  const index = useMemo(() => new Map(ids.map((id, i) => [id, i])), [ids]);
  const degree = useMemo(() => {
    const d = new Map<string, number>();
    for (const e of edges) {
      d.set(e.a, (d.get(e.a) ?? 0) + 1);
      d.set(e.b, (d.get(e.b) ?? 0) + 1);
    }
    return d;
  }, [edges]);
  const linked = useMemo(
    () => new Set(selectedId ? neighbors(selectedId, edges).map((n) => n.id) : []),
    [selectedId, edges],
  );

  // Animación: la red se asienta sola (con «reducir movimiento» aparece ya colocada)
  useEffect(() => {
    const step = () => {
      raf.current = null;
      alpha.current = Math.max(0, alpha.current - 0.006);
      tickLayout(layout, alpha.current, pinned.current);
      setFrame((f) => f + 1);
      if (alpha.current > 0.02 || pinned.current.size) raf.current = requestAnimationFrame(step);
    };
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      settleLayout(layout);
      alpha.current = 0;
    } else {
      alpha.current = 1;
      raf.current = requestAnimationFrame(step);
    }
    const reheat = () => {
      alpha.current = Math.max(alpha.current, 0.35);
      if (raf.current === null && !reduced) raf.current = requestAnimationFrame(step);
    };
    reheatRef.current = reheat;
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
      raf.current = null;
    };
  }, [layout]);

  const toSvg = (e: React.PointerEvent) => {
    const el = svg.current;
    if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };

  const down = (e: React.PointerEvent, i: number) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pinned.current.add(i);
    drag.current = { index: i, moved: false, startX: e.clientX, startY: e.clientY };
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 4) d.moved = true;
    if (!d.moved) return;
    const p = toSvg(e);
    layout.x[d.index] = Math.min(W - 20, Math.max(20, p.x));
    layout.y[d.index] = Math.min(H - 20, Math.max(20, p.y));
    reheatRef.current();
    setFrame((f) => f + 1);
  };
  const up = (id: string) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    pinned.current.delete(d.index);
    if (!d.moved) onSelect(id === selectedId ? null : id);
    else reheatRef.current();
  };

  const dim = (id: string) => {
    if (matchIds) return !matchIds.has(id);
    if (selectedId) return id !== selectedId && !linked.has(id);
    return false;
  };

  return (
    <svg
      ref={svg}
      viewBox={`0 0 ${W} ${H}`}
      role="group"
      aria-label="Red de recuerdos"
      className="bg-surface-2/40 rounded-inner h-auto w-full touch-none select-none"
      onPointerMove={move}
    >
      <g>
        {edges.map((e) => {
          const i = index.get(e.a);
          const j = index.get(e.b);
          if (i === undefined || j === undefined) return null;
          const active = selectedId === e.a || selectedId === e.b;
          const faded = (matchIds && !(matchIds.has(e.a) && matchIds.has(e.b))) || (selectedId && !active);
          return (
            <line
              key={`${e.a}-${e.b}`}
              x1={layout.x[i]}
              y1={layout.y[i]}
              x2={layout.x[j]}
              y2={layout.y[j]}
              stroke={active ? "var(--text-muted)" : "var(--border-strong)"}
              strokeWidth={e.kind === "link" ? 1.8 : 1}
              strokeDasharray={e.kind === "tag" ? "3 4" : undefined}
              opacity={faded ? 0.25 : 1}
            />
          );
        })}
      </g>
      <g>
        {nodes.map((n, i) => {
          const selected = n.id === selectedId;
          const r = 6 + Math.min(degree.get(n.id) ?? 0, 8) * 1.4;
          const showLabel =
            selected || linked.has(n.id) || hover === n.id || (matchIds?.has(n.id) ?? false) || nodes.length <= 30;
          return (
            <g
              key={n.id}
              transform={`translate(${layout.x[i]} ${layout.y[i]})`}
              opacity={dim(n.id) ? 0.28 : 1}
              tabIndex={0}
              role="button"
              aria-pressed={selected}
              aria-label={`${n.title}${n.tags.length ? `, etiquetas: ${n.tags.join(", ")}` : ""}`}
              className="cursor-pointer outline-none"
              onPointerDown={(e) => down(e, i)}
              onPointerUp={() => up(n.id)}
              onPointerCancel={() => {
                drag.current = null;
                pinned.current.delete(i);
              }}
              onPointerEnter={() => setHover(n.id)}
              onPointerLeave={() => setHover((h) => (h === n.id ? null : h))}
              onFocus={() => setHover(n.id)}
              onBlur={() => setHover((h) => (h === n.id ? null : h))}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(selected ? null : n.id);
                }
              }}
            >
              {/* Zona de toque más grande que el punto, para el dedo */}
              <circle r={Math.max(r + 8, 18)} fill="transparent" />
              {selected && <circle r={r + 6} fill="none" stroke="var(--text)" strokeWidth={1.5} opacity={0.7} />}
              <circle r={r} fill={nodeColor(n.tags)} opacity={0.9} stroke="var(--bg)" strokeWidth={2} />
              {showLabel && (
                <text
                  y={r + 14}
                  textAnchor="middle"
                  fontSize={11}
                  fill="var(--text)"
                  stroke="var(--bg)"
                  strokeWidth={3}
                  paintOrder="stroke"
                  pointerEvents="none"
                >
                  {short(n.title)}
                </text>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
