import { describe, expect, it } from "vitest";
import { matchAsset } from "./board";

describe("inversiones · buscar activo", () => {
  const asset = { name: "Fondo Índice Mundial", isin: "IE00B4L5Y983", priceSymbol: "IWDA.AS" };

  it("encuentra por nombre sin tildes, por ISIN o por símbolo", () => {
    expect(matchAsset(asset, "indice")).toBe(true);
    expect(matchAsset(asset, "ie00b4")).toBe(true);
    expect(matchAsset(asset, "iwda")).toBe(true);
    expect(matchAsset(asset, "europa")).toBe(false);
    expect(matchAsset(asset, "  ")).toBe(false);
  });
});
