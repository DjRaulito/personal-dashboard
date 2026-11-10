// Piezas puras de la red de memoria: conexiones entre recuerdos y colocación de los nodos.

export interface BrainNode {
  id: string;
  title: string;
  content: string;
  tags: string[];
  source: string;
  updated_at: string;
}

export interface BrainEdge {
  a: string;
  b: string;
  /** link = conexión explícita; tag = comparten etiquetas */
  kind: "link" | "tag";
  weight: number;
}

/** Más miembros que esto en una misma etiqueta y la red sería una maraña: no se conectan por ella. */
const MAX_TAG_GROUP = 40;

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/** Conexiones explícitas + las que salen de compartir etiquetas (la explícita manda). */
export function buildEdges(nodes: Pick<BrainNode, "id" | "tags">[], links: { a: string; b: string }[]): BrainEdge[] {
  const ids = new Set(nodes.map((n) => n.id));
  const edges = new Map<string, BrainEdge>();
  for (const l of links) {
    if (l.a === l.b || !ids.has(l.a) || !ids.has(l.b)) continue;
    edges.set(pairKey(l.a, l.b), { a: l.a, b: l.b, kind: "link", weight: 1 });
  }
  const byTag = new Map<string, string[]>();
  for (const n of nodes) for (const t of new Set(n.tags)) byTag.set(t, [...(byTag.get(t) ?? []), n.id]);
  const shared = new Map<string, number>();
  for (const members of byTag.values()) {
    if (members.length < 2 || members.length > MAX_TAG_GROUP) continue;
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const k = pairKey(members[i], members[j]);
        shared.set(k, (shared.get(k) ?? 0) + 1);
      }
    }
  }
  for (const [k, weight] of shared) {
    if (edges.has(k)) continue;
    const [a, b] = k.split("|");
    edges.set(k, { a, b, kind: "tag", weight });
  }
  return [...edges.values()];
}

/** Recuerdos conectados con uno dado, con el tipo de conexión. */
export function neighbors(id: string, edges: BrainEdge[]): { id: string; kind: BrainEdge["kind"] }[] {
  const out: { id: string; kind: BrainEdge["kind"] }[] = [];
  for (const e of edges) {
    if (e.a === id) out.push({ id: e.b, kind: e.kind });
    else if (e.b === id) out.push({ id: e.a, kind: e.kind });
  }
  return out;
}

/** Recuerdos que contienen todas las palabras (título, contenido o etiquetas), sin tildes ni mayúsculas. */
export function matchesQuery(node: Pick<BrainNode, "title" | "content" | "tags">, query: string): boolean {
  const norm = (s: string) =>
    s
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase();
  const words = norm(query).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = norm(`${node.title} ${node.content} ${node.tags.join(" ")}`);
  return words.every((w) => hay.includes(w));
}

// ---------------------------------------------------------------------------
// Colocación (fuerzas: se repelen, las conexiones tiran y todo gravita al centro)
// ---------------------------------------------------------------------------

export interface Layout {
  ids: string[];
  x: Float64Array;
  y: Float64Array;
  vx: Float64Array;
  vy: Float64Array;
  /** Pares de índices conectados y su longitud de reposo */
  springs: { i: number; j: number; rest: number; strength: number }[];
  width: number;
  height: number;
}

/** Posición inicial determinista: en espiral, para que la misma red salga siempre igual. */
export function createLayout(ids: string[], edges: BrainEdge[], width: number, height: number): Layout {
  const n = ids.length;
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  const golden = Math.PI * (3 - Math.sqrt(5));
  const radius = Math.min(width, height) * 0.38;
  for (let i = 0; i < n; i++) {
    const r = radius * Math.sqrt((i + 0.5) / n);
    x[i] = width / 2 + r * Math.cos(i * golden);
    y[i] = height / 2 + r * Math.sin(i * golden);
  }
  const index = new Map(ids.map((id, i) => [id, i]));
  const springs: Layout["springs"] = [];
  for (const e of edges) {
    const i = index.get(e.a);
    const j = index.get(e.b);
    if (i === undefined || j === undefined) continue;
    springs.push(
      e.kind === "link"
        ? { i, j, rest: 90, strength: 0.08 }
        : { i, j, rest: 130, strength: Math.min(0.04 * e.weight, 0.09) },
    );
  }
  return { ids, x, y, vx: new Float64Array(n), vy: new Float64Array(n), springs, width, height };
}

/** Un paso de simulación. `alpha` (1 → 0) enfría el movimiento. Devuelve la energía cinética media. */
export function tickLayout(l: Layout, alpha: number, pinned?: ReadonlySet<number>): number {
  const n = l.ids.length;
  const { x, y, vx, vy } = l;
  const repulsion = 11000;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      let dx = x[i] - x[j];
      let dy = y[i] - y[j];
      let d2 = dx * dx + dy * dy;
      if (d2 < 1) {
        // Evita la división por cero cuando dos nodos coinciden
        dx = (i - j) * 0.01;
        dy = 0.01;
        d2 = 1;
      }
      if (d2 > 250000) continue; // más allá de 500 px no se notan
      const f = (repulsion / d2) * alpha;
      const d = Math.sqrt(d2);
      const fx = (dx / d) * f;
      const fy = (dy / d) * f;
      vx[i] += fx;
      vy[i] += fy;
      vx[j] -= fx;
      vy[j] -= fy;
    }
  }
  for (const s of l.springs) {
    const dx = x[s.j] - x[s.i];
    const dy = y[s.j] - y[s.i];
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const f = (d - s.rest) * s.strength * alpha;
    const fx = (dx / d) * f;
    const fy = (dy / d) * f;
    vx[s.i] += fx;
    vy[s.i] += fy;
    vx[s.j] -= fx;
    vy[s.j] -= fy;
  }
  let energy = 0;
  const margin = 28;
  for (let i = 0; i < n; i++) {
    if (pinned?.has(i)) {
      vx[i] = 0;
      vy[i] = 0;
      continue;
    }
    vx[i] += (l.width / 2 - x[i]) * 0.004 * alpha; // gravedad suave al centro
    vy[i] += (l.height / 2 - y[i]) * 0.004 * alpha;
    vx[i] *= 0.82;
    vy[i] *= 0.82;
    x[i] = Math.min(l.width - margin, Math.max(margin, x[i] + vx[i]));
    y[i] = Math.min(l.height - margin, Math.max(margin, y[i] + vy[i]));
    energy += vx[i] * vx[i] + vy[i] * vy[i];
  }
  return n ? energy / n : 0;
}

/** Deja la red ya asentada (sin animación). */
export function settleLayout(l: Layout, iterations = 280): void {
  for (let k = 0; k < iterations; k++) tickLayout(l, Math.max(0.05, 1 - k / iterations));
}

const NODE_COLORS = ["var(--finance)", "var(--gym)", "var(--content)", "var(--nutrition)", "var(--attention)"];

/** Color de un nodo según su primera etiqueta (siempre el mismo para la misma etiqueta). */
export function nodeColor(tags: string[]): string {
  if (!tags.length) return "var(--text-muted)";
  let h = 0;
  for (const ch of tags[0]) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return NODE_COLORS[h % NODE_COLORS.length];
}
