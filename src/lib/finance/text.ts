/** Normaliza un texto para comparar: sin tildes, mayúsculas y espacios simples. */
export function normalizeText(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
}
