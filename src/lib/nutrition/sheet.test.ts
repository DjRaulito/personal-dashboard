import { describe, expect, it } from "vitest";
import { assignYears, mergeControl, parseSheet, sheetIdFrom } from "./sheet";

const weights = [
  [],
  ["", "HOJA DE CONTROL"],
  ["", "FECHA", "", "", "", "PESO(KG)"],
  ["", "04/12", "", "", "", "70,6"],
  ["", "18/12", "", "", "", "72,2"],
  ["", "17/12", "", "", "", "72,7", "BÁSCULA RAUL"],
  ["", "02/01", "", "", "", "71,6", "BÁSCULA RAUL"],
  ["", "02/01", "", "", "", "71,2"],
  ["", "13/05", "", "", "", "67,5", "empezamos el volumen"],
  ["", "28/10", "", "", "", "76,95"],
  ["", "11/10", "", "", "", "77,7"],
];

const measures = [
  ["", "¡RELLENAR CADA 14 DÍAS"],
  ["", "FECHA", "PECHO", "HOMBRO", "BRAZO", "ABDOMEN ALTURA OMBLIGO", "CINTURA", "CADERA", "MUSLO", "GEMELO"],
  ["", "04/12", "105", "121", "36,5", "84", "", "", "53", "40"],
  ["", "02/01", "106", "123", "37", "84", "", "", "55", "40"],
  ["", "13/5", "101", "120", "36", "80", "74", "", "54", "39"],
  ["", "28/10", "106", "125", "39", "88", "84", "", "60", "40"],
  ["", "11/11", "106", "126", "39", "88", "84", "", "60", "40"],
];

describe("hoja de control", () => {
  it("lee las columnas por su cabecera y las notas sueltas", () => {
    const rows = parseSheet(measures);
    expect(rows).toHaveLength(5);
    expect(rows[0]).toEqual({
      day: 4,
      month: 12,
      values: { chest_cm: 105, shoulder_cm: 121, arm_cm: 36.5, abdomen_cm: 84, thigh_cm: 53, calf_cm: 40 },
      note: null,
    });
    expect(parseSheet(weights)[2]).toEqual({ day: 17, month: 12, values: { weight_kg: 72.7 }, note: "BÁSCULA RAUL" });
    expect(parseSheet([["sin", "cabecera"]])).toEqual([]);
  });

  it("deduce el año por el orden de las filas", () => {
    const dates = assignYears(parseSheet(measures), "2025-11-16").map((r) => r.date);
    expect(dates).toEqual(["2024-12-04", "2025-01-02", "2025-05-13", "2025-10-28", "2025-11-11"]);
    // Si la última fila quedara en el futuro, todo es un año antes
    expect(assignYears(parseSheet(measures), "2025-11-01")[0].date).toBe("2023-12-04");
  });

  it("junta peso y medidas, corrige el mes mal escrito y prefiere el peso de la consulta", () => {
    const entries = mergeControl([parseSheet(weights), parseSheet(measures)], "2025-11-16");
    expect(entries.map((e) => e.date)).toEqual([
      "2024-12-04",
      "2024-12-17",
      "2024-12-18",
      "2025-01-02",
      "2025-05-13",
      "2025-10-28",
      "2025-11-11",
    ]);
    const byDate = new Map(entries.map((e) => [e.date, e]));
    expect(byDate.get("2025-01-02")).toMatchObject({ values: { weight_kg: 71.2, chest_cm: 106 }, note: null });
    expect(byDate.get("2024-12-17")).toMatchObject({ values: { weight_kg: 72.7 }, note: "BÁSCULA RAUL" });
    expect(byDate.get("2025-05-13")?.note).toBe("empezamos el volumen");
    expect(byDate.get("2025-11-11")).toMatchObject({ values: { weight_kg: 77.7, waist_cm: 84 } });
  });

  it("saca el id de la hoja de su enlace", () => {
    const id = "1Abc_def-GHIjklmnopqrstuvwxyz0123456789";
    expect(sheetIdFrom(`https://docs.google.com/spreadsheets/d/${id}/edit?usp=sharing`)).toBe(id);
    expect(sheetIdFrom(id)).toBe(id);
    expect(sheetIdFrom("https://example.com/otra-cosa")).toBeNull();
  });
});
