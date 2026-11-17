import "server-only";
import { z } from "zod";
import { GoogleAuthError } from "./calendar";

// Lectura de hojas de cálculo de Google (solo lectura): la hoja de control de la nutricionista.

export class SheetAccessError extends Error {}

const metaSchema = z.object({
  sheets: z.array(z.object({ properties: z.object({ title: z.string() }) })).default([]),
});
const valuesSchema = z.object({
  valueRanges: z.array(z.object({ values: z.array(z.array(z.unknown())).default([]) })).default([]),
});

async function sheets(token: string, url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(20000),
    cache: "no-store",
  });
  if (res.status === 401) throw new GoogleAuthError("Google rechazó el acceso a la hoja (401)");
  if (res.status === 403 || res.status === 404) {
    throw new SheetAccessError(
      res.status === 404
        ? "No se encontró la hoja. Revisa el enlace."
        : "Tu cuenta de Google no puede leer esa hoja, o la API de Google Sheets no está activada en el proyecto.",
    );
  }
  if (!res.ok) throw new Error(`Google Sheets ${res.status}`);
  return res.json();
}

/** Todas las pestañas de una hoja, cada una como filas de celdas tal y como se ven. */
export async function readSpreadsheet(token: string, spreadsheetId: string): Promise<unknown[][][]> {
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}`;
  const meta = metaSchema.parse(await sheets(token, `${base}?fields=sheets.properties.title`));
  const titles = meta.sheets.map((s) => s.properties.title).slice(0, 10);
  if (titles.length === 0) return [];
  const params = new URLSearchParams({ valueRenderOption: "FORMATTED_VALUE" });
  for (const title of titles) params.append("ranges", `'${title.replace(/'/g, "''")}'!A1:Z500`);
  const data = valuesSchema.parse(await sheets(token, `${base}/values:batchGet?${params}`));
  return data.valueRanges.map((r) => r.values);
}
