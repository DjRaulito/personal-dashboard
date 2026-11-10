import { describe, expect, it } from "vitest";
import { receiptPrompt, receiptSchema, receiptToForm } from "./receipt";

const cats = [
  { id: "a", label: "Alimentación" },
  { id: "b", label: "Alimentación › Supermercado" },
  { id: "c", label: "Ocio › Cine" },
];

describe("ticket", () => {
  it("lista las categorías en el prompt", () => {
    expect(receiptPrompt(["Ocio › Cine"], "2026-11-10")).toContain("· Ocio › Cine");
  });

  it("rellena el formulario y busca la categoría por nombre", () => {
    const r = receiptSchema.parse({ merchant: "Mercadona", date: "2026-11-08", total: "23.4", category: "supermercado" });
    expect(receiptToForm(r, cats, "2026-11-10")).toEqual({
      description: "Mercadona",
      booked_on: "2026-11-08",
      amount: "23,40",
      category_id: "b",
      notes: "",
    });
  });

  it("descarta fechas futuras o mal formadas y categorías desconocidas", () => {
    const r = receiptSchema.parse({ date: "2027-01-01", total: 5, category: "Coches", summary: "Café" });
    expect(receiptToForm(r, cats, "2026-11-10")).toMatchObject({
      description: "Café",
      booked_on: null,
      category_id: null,
    });
  });
});
