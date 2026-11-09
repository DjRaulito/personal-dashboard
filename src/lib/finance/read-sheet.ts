// Lectura de extractos en el navegador: CSV/TXT (UTF-8 o Windows-1252) y Excel (.xlsx).

export type SheetRows = unknown[][];

/** Decodifica en UTF-8 y, si no es válido, en Windows-1252 (habitual en bancos españoles). */
export function decodeText(buffer: ArrayBuffer): string {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    text = new TextDecoder("windows-1252").decode(buffer);
  }
  return text.replace(/^﻿/, "");
}

export async function readSheetFile(file: File): Promise<SheetRows> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx")) {
    const { readSheet } = await import("read-excel-file/browser");
    return (await readSheet(file)) as SheetRows;
  }
  if (name.endsWith(".xls")) {
    throw new Error("Los .xls antiguos no se pueden leer. Ábrelo y guárdalo como .xlsx o .csv.");
  }
  const Papa = (await import("papaparse")).default;
  const text = decodeText(await file.arrayBuffer());
  const result = Papa.parse<string[]>(text, { skipEmptyLines: false });
  return result.data;
}
