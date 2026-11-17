// Lectura de la hoja de control de la nutricionista (peso y perímetros cada 14 días).
// La hoja tiene una pestaña por tabla; cada tabla tiene una fila de cabecera con «FECHA» y
// debajo una fila por revisión. Las fechas van sin año («04/12»), así que el año se deduce
// del orden: cuando el mes vuelve a empezar, es el año siguiente.

export const MEASURES = [
  "weight_kg",
  "chest_cm",
  "shoulder_cm",
  "arm_cm",
  "abdomen_cm",
  "waist_cm",
  "hip_cm",
  "thigh_cm",
  "calf_cm",
] as const;
export type Measure = (typeof MEASURES)[number];

export const MEASURE_LABELS: Record<Measure, string> = {
  weight_kg: "Peso",
  chest_cm: "Pecho",
  shoulder_cm: "Hombro",
  arm_cm: "Brazo",
  abdomen_cm: "Abdomen",
  waist_cm: "Cintura",
  hip_cm: "Cadera",
  thigh_cm: "Muslo",
  calf_cm: "Gemelo",
};

// Cabecera de columna → medida, y el rango de valores creíble (el mismo que valida la BD)
const COLUMNS: { match: RegExp; measure: Measure; min: number; max: number }[] = [
  { match: /peso/i, measure: "weight_kg", min: 20, max: 400 },
  { match: /pecho/i, measure: "chest_cm", min: 30, max: 250 },
  { match: /hombro/i, measure: "shoulder_cm", min: 50, max: 250 },
  { match: /brazo|b[ií]ceps/i, measure: "arm_cm", min: 10, max: 80 },
  { match: /abdomen|ombligo/i, measure: "abdomen_cm", min: 30, max: 250 },
  { match: /cintura/i, measure: "waist_cm", min: 30, max: 250 },
  { match: /cadera/i, measure: "hip_cm", min: 30, max: 250 },
  { match: /muslo/i, measure: "thigh_cm", min: 20, max: 120 },
  { match: /gemelo/i, measure: "calf_cm", min: 15, max: 80 },
];

export interface SheetRow {
  day: number;
  month: number;
  values: Partial<Record<Measure, number>>;
  note: string | null;
}

export interface ControlEntry {
  date: string; // AAAA-MM-DD
  values: Partial<Record<Measure, number>>;
  note: string | null;
}

const cell = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());

function parseDayMonth(text: string): { day: number; month: number } | null {
  const m = /^(\d{1,2})\s*[/.-]\s*(\d{1,2})(?:\s*[/.-]\s*\d{2,4})?$/.exec(text);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  return day >= 1 && day <= 31 && month >= 1 && month <= 12 ? { day, month } : null;
}

const parseNumber = (text: string) => (/^\d{1,3}(?:[.,]\d{1,2})?$/.test(text) ? Number(text.replace(",", ".")) : null);

/** Filas de una pestaña: busca la cabecera con «FECHA» y lee las medidas de cada fila con fecha. */
export function parseSheet(rows: unknown[][]): SheetRow[] {
  const headerIndex = rows.findIndex((r) => r.some((c) => /^fecha/i.test(cell(c))));
  if (headerIndex < 0) return [];
  const header = rows[headerIndex].map(cell);
  const dateCol = header.findIndex((h) => /^fecha/i.test(h));
  const cols = header
    .map((h, index) => ({ index, def: index === dateCol ? undefined : COLUMNS.find((c) => c.match.test(h)) }))
    .filter((c): c is { index: number; def: (typeof COLUMNS)[number] } => !!c.def);
  if (cols.length === 0) return [];
  const mapped = new Set([dateCol, ...cols.map((c) => c.index)]);

  const out: SheetRow[] = [];
  for (const row of rows.slice(headerIndex + 1)) {
    const date = parseDayMonth(cell(row[dateCol]));
    if (!date) continue;
    const values: SheetRow["values"] = {};
    for (const { index, def } of cols) {
      const v = parseNumber(cell(row[index]));
      if (v !== null && v >= def.min && v <= def.max) values[def.measure] = v;
    }
    // Lo que haya escrito fuera de las columnas de medidas es una nota de esa revisión
    const note = row
      .map((c, i) => (mapped.has(i) ? "" : cell(c)))
      .filter(Boolean)
      .join(" · ");
    if (Object.keys(values).length || note) out.push({ ...date, values, note: note || null });
  }
  return out;
}

const iso = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

/** Pone año a las filas: empieza un año nuevo cuando el mes cae de final de año a principio. */
export function assignYears(rows: SheetRow[], today: string): (SheetRow & { date: string })[] {
  let offset = 0;
  const offsets = rows.map((row, i) => {
    if (i > 0 && rows[i - 1].month - row.month >= 6) offset += 1;
    return offset;
  });
  // El año de partida es el más reciente con el que la última fila no queda en el futuro
  const last = rows[rows.length - 1];
  let base = Number(today.slice(0, 4)) - offset;
  if (last && iso(base + offset, last.month, last.day) > today) base -= 1;
  return rows.map((row, i) => ({ ...row, date: iso(base + offsets[i], row.month, row.day) }));
}

const ownScale = (note: string | null) => /b[aá]scula/i.test(note ?? "");

const nextMonth = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return m === 12 ? iso(y + 1, 1, d) : iso(y, m + 1, d);
};

/**
 * Junta las pestañas en una entrada por fecha. Dos arreglos para los despistes habituales:
 * - Una fecha que va hacia atrás y que un mes después coincide con una revisión de otra pestaña
 *   es un mes mal escrito («11/10» por «11/11»): se corrige.
 * - Si un día hay dos pesos y uno es de la báscula de casa, vale el de la consulta.
 */
export function mergeControl(sheets: SheetRow[][], today: string): ControlEntry[] {
  const dated = sheets.map((rows) => assignYears(rows, today));
  const allDates = dated.map((rows) => new Set(rows.map((r) => r.date)));
  dated.forEach((rows, s) => {
    rows.forEach((row, i) => {
      if (i === 0 || row.date >= rows[i - 1].date) return;
      const fixed = nextMonth(row.date);
      const elsewhere = allDates.some((dates, other) => other !== s && dates.has(fixed));
      if (elsewhere && !allDates[s].has(fixed) && fixed <= today) row.date = fixed;
    });
  });

  const byDate = new Map<string, ControlEntry & { ownScale: boolean }>();
  for (const row of dated.flat()) {
    const current = byDate.get(row.date);
    const mine = ownScale(row.note);
    if (!current) {
      byDate.set(row.date, { date: row.date, values: { ...row.values }, note: row.note, ownScale: mine });
      continue;
    }
    const clash = row.values.weight_kg !== undefined && current.values.weight_kg !== undefined;
    if (clash && mine && !current.ownScale) continue; // ya está el peso de la consulta
    if (clash && current.ownScale && !mine) {
      current.note = null; // la nota era de la báscula de casa
      current.ownScale = false;
    } else if (mine) {
      current.ownScale = true;
    }
    Object.assign(current.values, row.values);
    if (row.note && row.note !== current.note) current.note = current.note ? `${current.note} · ${row.note}` : row.note;
  }
  return [...byDate.values()]
    .map(({ date, values, note }) => ({ date, values, note }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Id de una hoja de cálculo de Google a partir de su enlace (o del propio id). */
export function sheetIdFrom(input: string): string | null {
  const text = input.trim();
  const fromUrl = /\/spreadsheets\/d\/([A-Za-z0-9_-]{20,120})/.exec(text)?.[1];
  if (fromUrl) return fromUrl;
  return /^[A-Za-z0-9_-]{20,120}$/.test(text) ? text : null;
}
