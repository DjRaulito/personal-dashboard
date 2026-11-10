import { describe, expect, it } from "vitest";
import { buildEdges, createLayout, matchesQuery, neighbors, nodeColor, settleLayout, tickLayout } from "./graph";

const nodes = [
  { id: "a", tags: ["gym", "rutina"] },
  { id: "b", tags: ["rutina"] },
  { id: "c", tags: ["dinero"] },
  { id: "d", tags: [] },
];

describe("conexiones", () => {
  it("une los recuerdos que comparten etiquetas y respeta las explícitas", () => {
    const edges = buildEdges(nodes, [{ a: "c", b: "d" }]);
    expect(edges).toContainEqual({ a: "a", b: "b", kind: "tag", weight: 1 });
    expect(edges).toContainEqual({ a: "c", b: "d", kind: "link", weight: 1 });
    expect(edges).toHaveLength(2);
  });

  it("la conexión explícita sustituye a la de etiquetas del mismo par", () => {
    const edges = buildEdges(nodes, [{ a: "b", b: "a" }]);
    expect(edges.filter((e) => e.kind === "link")).toHaveLength(1);
    expect(edges.filter((e) => e.kind === "tag")).toHaveLength(0);
  });

  it("ignora enlaces a recuerdos que no existen o a sí mismos", () => {
    expect(
      buildEdges(nodes, [
        { a: "a", b: "zzz" },
        { a: "c", b: "c" },
      ]),
    ).toHaveLength(1);
  });

  it("no conecta por una etiqueta con demasiados recuerdos", () => {
    const many = Array.from({ length: 41 }, (_, i) => ({ id: `n${i}`, tags: ["todo"] }));
    expect(buildEdges(many, [])).toEqual([]);
  });

  it("lista los vecinos de un recuerdo", () => {
    const edges = buildEdges(nodes, [{ a: "c", b: "a" }]);
    expect(
      neighbors("a", edges)
        .map((n) => n.id)
        .sort(),
    ).toEqual(["b", "c"]);
  });
});

describe("búsqueda", () => {
  const m = { title: "Dieta de definición", content: "Arroz y pollo", tags: ["nutrición"] };
  it("encuentra sin tildes ni mayúsculas y por todas las palabras", () => {
    expect(matchesQuery(m, "DEFINICION pollo")).toBe(true);
    expect(matchesQuery(m, "nutricion")).toBe(true);
    expect(matchesQuery(m, "pollo pescado")).toBe(false);
    expect(matchesQuery(m, "  ")).toBe(true);
  });
});

describe("colocación", () => {
  const ids = ["a", "b", "c", "d"];
  const edges = buildEdges(nodes, []);

  it("es determinista y deja todo dentro del lienzo", () => {
    const run = () => {
      const l = createLayout(ids, edges, 800, 560);
      settleLayout(l);
      return l;
    };
    const one = run();
    const two = run();
    expect(Array.from(one.x)).toEqual(Array.from(two.x));
    for (let i = 0; i < ids.length; i++) {
      expect(one.x[i]).toBeGreaterThanOrEqual(0);
      expect(one.x[i]).toBeLessThanOrEqual(800);
      expect(Number.isFinite(one.y[i])).toBe(true);
    }
  });

  it("los conectados quedan más cerca que los que no lo están", () => {
    const l = createLayout(
      ids,
      buildEdges(nodes, [
        { a: "a", b: "b" },
        { a: "c", b: "d" },
      ]),
      800,
      560,
    );
    settleLayout(l);
    const dist = (i: number, j: number) => Math.hypot(l.x[i] - l.x[j], l.y[i] - l.y[j]);
    expect(dist(0, 1)).toBeLessThan(dist(0, 2));
  });

  it("no se rompe con nodos en el mismo punto ni con la red vacía", () => {
    const l = createLayout(["a", "b"], [], 100, 100);
    l.x.fill(50);
    l.y.fill(50);
    expect(Number.isFinite(tickLayout(l, 1))).toBe(true);
    expect(tickLayout(createLayout([], [], 100, 100), 1)).toBe(0);
  });
});

describe("color", () => {
  it("es estable por etiqueta y gris sin etiquetas", () => {
    expect(nodeColor(["gym"])).toBe(nodeColor(["gym", "otra"]));
    expect(nodeColor([])).toBe("var(--text-muted)");
  });
});
