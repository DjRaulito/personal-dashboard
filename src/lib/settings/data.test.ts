import { describe, expect, it } from "vitest";
import { confirmWord, EXPORT_TABLES, MODULE_TABLES } from "./data";

describe("ajustes · datos", () => {
  it("no exporta secretos", () => {
    expect(EXPORT_TABLES).not.toContain("integrations");
    expect(EXPORT_TABLES).not.toContain("brain_tokens");
  });

  it("todo lo que se puede borrar también se exporta antes", () => {
    for (const { tables } of Object.values(MODULE_TABLES)) {
      for (const t of tables) expect(EXPORT_TABLES).toContain(t);
    }
  });

  it("la confirmación nombra el módulo", () => {
    expect(confirmWord("nutricion")).toBe("borrar nutrición");
  });
});
