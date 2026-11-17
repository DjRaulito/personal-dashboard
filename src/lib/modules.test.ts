import { describe, expect, it } from "vitest";
import { MODULES, modulesByPhase } from "./modules";

describe("modulesByPhase", () => {
  it("ordena los módulos por fase", () => {
    const phases = modulesByPhase().map((m) => m.phase);
    expect(phases).toEqual([...phases].sort((a, b) => a - b));
  });

  it("incluye los siete módulos del plan", () => {
    expect(MODULES.map((m) => m.key).sort()).toEqual(
      ["agentes", "armario", "calendario", "contenido", "finanzas", "gimnasio", "nutricion"].sort(),
    );
  });

  it("no muta la lista original", () => {
    const before = MODULES.map((m) => m.key);
    modulesByPhase();
    expect(MODULES.map((m) => m.key)).toEqual(before);
  });
});
