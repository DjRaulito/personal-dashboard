"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { importTransactions, type ImportResult } from "@/app/(app)/finanzas/actions";
import { buttonClass, Field, inputClass } from "@/components/ui";
import { DATE_FORMATS, guessMapping, mapRows, mappingSchema, type ImportMapping } from "@/lib/finance/import";
import { formatCents } from "@/lib/finance/money";
import { readSheetFile, type SheetRows } from "@/lib/finance/read-sheet";

interface Profile {
  name: string;
  account_id: string | null;
  mapping: unknown;
}

const DEFAULT_MAPPING: ImportMapping = {
  skipRows: 0,
  hasHeader: true,
  dateColumn: 0,
  dateFormat: "DD/MM/YYYY",
  descriptionColumns: [1],
  amountMode: "single",
  amountColumn: 2,
  decimal: ",",
  invertSign: false,
};

function columnLabel(rows: SheetRows, mapping: ImportMapping, index: number) {
  const header = mapping.hasHeader ? rows[mapping.skipRows]?.[index] : undefined;
  const name = header !== undefined && header !== null && String(header).trim() ? String(header).trim() : null;
  return `${String.fromCharCode(65 + (index % 26))}${name ? ` · ${name}` : ""}`;
}

export function Importer({
  accounts,
  profiles,
}: {
  accounts: { id: string; name: string; currency: string }[];
  profiles: Profile[];
}) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<SheetRows | null>(null);
  const [mapping, setMapping] = useState<ImportMapping>(DEFAULT_MAPPING);
  const [profileName, setProfileName] = useState("");
  const [saveProfile, setSaveProfile] = useState(true);
  const [readError, setReadError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, startTransition] = useTransition();

  const account = accounts.find((a) => a.id === accountId);
  const profileFor = (id: string) => profiles.find((p) => p.account_id === id);

  function applyProfileOrGuess(sheet: SheetRows, forAccount: string) {
    const profile = profileFor(forAccount);
    const saved = profile ? mappingSchema.safeParse(profile.mapping) : null;
    if (saved?.success) {
      setMapping(saved.data);
      setProfileName(profile!.name);
    } else {
      setMapping({ ...DEFAULT_MAPPING, ...guessMapping(sheet) });
      setProfileName(accounts.find((a) => a.id === forAccount)?.name ?? "");
    }
  }

  async function onFile(file: File | undefined) {
    setResult(null);
    setReadError(null);
    setRows(null);
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return setReadError("El archivo pesa más de 5 MB.");
    try {
      const sheet = await readSheetFile(file);
      setRows(sheet);
      setFileName(file.name);
      applyProfileOrGuess(sheet, accountId);
    } catch (e) {
      setReadError(e instanceof Error ? e.message : "No se pudo leer el archivo.");
    }
  }

  const columnCount = useMemo(() => Math.max(0, ...(rows ?? []).slice(0, 50).map((r) => r.length)), [rows]);
  const parsed = useMemo(() => (rows ? mapRows(rows, mapping) : null), [rows, mapping]);
  const set = <K extends keyof ImportMapping>(key: K, value: ImportMapping[K]) =>
    setMapping((m) => ({ ...m, [key]: value }));

  const columnSelect = (key: "dateColumn" | "amountColumn" | "debitColumn" | "creditColumn", label: string) => (
    <Field label={label}>
      <select value={mapping[key] ?? ""} onChange={(e) => set(key, Number(e.target.value))} className={inputClass}>
        <option value="" disabled>
          Elegir…
        </option>
        {Array.from({ length: columnCount }, (_, i) => (
          <option key={i} value={i}>
            {columnLabel(rows!, mapping, i)}
          </option>
        ))}
      </select>
    </Field>
  );

  function submit() {
    if (!parsed || parsed.rows.length === 0) return;
    startTransition(async () => {
      setResult(
        await importTransactions({
          accountId,
          rows: parsed.rows,
          profileName: saveProfile && profileName.trim() ? profileName.trim() : undefined,
          mapping: saveProfile ? mapping : undefined,
        }),
      );
    });
  }

  if (accounts.length === 0) {
    return (
      <p className="text-muted text-sm">
        Primero crea una cuenta en{" "}
        <Link href="/finanzas/cuentas" className="text-text underline">
          Cuentas
        </Link>
        .
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Cuenta de destino">
          <select
            value={accountId}
            onChange={(e) => {
              setAccountId(e.target.value);
              setResult(null);
              if (rows) applyProfileOrGuess(rows, e.target.value);
            }}
            className={inputClass}
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {profileFor(a.id) ? " · plantilla guardada" : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Extracto (.csv, .txt o .xlsx)">
          <input
            type="file"
            accept=".csv,.txt,.xlsx,.xls,text/csv"
            onChange={(e) => onFile(e.target.files?.[0])}
            className={`${inputClass} file:bg-surface file:text-text file:mr-3 file:rounded-full file:border-0 file:px-3 file:py-1`}
          />
        </Field>
      </div>
      <p className="text-muted -mt-3 text-xs">
        El archivo se lee en tu navegador; solo se envían los movimientos ya convertidos.
      </p>
      {readError && (
        <p role="alert" className="text-attention text-sm">
          {readError}
        </p>
      )}

      {rows && parsed && (
        <>
          <section aria-labelledby="mapeo">
            <h3 id="mapeo" className="font-semibold">
              Columnas de {fileName}
            </h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Filas a saltar al principio">
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={mapping.skipRows}
                  onChange={(e) => set("skipRows", Math.max(0, Math.min(50, Number(e.target.value) || 0)))}
                  className={`${inputClass} tabular-nums`}
                />
              </Field>
              <label className="flex items-center gap-2 self-end pb-2.5 text-sm">
                <input
                  type="checkbox"
                  checked={mapping.hasHeader}
                  onChange={(e) => set("hasHeader", e.target.checked)}
                  className="accent-finance h-4 w-4"
                />
                La primera fila es la cabecera
              </label>
              {columnSelect("dateColumn", "Fecha")}
              <Field label="Formato de fecha">
                <select
                  value={mapping.dateFormat}
                  onChange={(e) => set("dateFormat", e.target.value as ImportMapping["dateFormat"])}
                  className={inputClass}
                >
                  {DATE_FORMATS.map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
              </Field>
              <fieldset className="text-sm sm:col-span-2 lg:col-span-4">
                <legend className="text-muted mb-1.5">Concepto (puedes unir varias columnas)</legend>
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: columnCount }, (_, i) => (
                    <label key={i} className="bg-surface-2 flex items-center gap-2 rounded-full px-3 py-1.5">
                      <input
                        type="checkbox"
                        checked={mapping.descriptionColumns.includes(i)}
                        onChange={(e) =>
                          set(
                            "descriptionColumns",
                            e.target.checked
                              ? [...mapping.descriptionColumns, i].sort((a, b) => a - b)
                              : mapping.descriptionColumns.filter((c) => c !== i),
                          )
                        }
                        className="accent-finance h-4 w-4"
                      />
                      {columnLabel(rows, mapping, i)}
                    </label>
                  ))}
                </div>
              </fieldset>
              <Field label="Importe en">
                <select
                  value={mapping.amountMode}
                  onChange={(e) => set("amountMode", e.target.value as ImportMapping["amountMode"])}
                  className={inputClass}
                >
                  <option value="single">Una columna (con signo)</option>
                  <option value="split">Dos columnas (cargo y abono)</option>
                </select>
              </Field>
              {mapping.amountMode === "single" ? (
                columnSelect("amountColumn", "Columna del importe")
              ) : (
                <>
                  {columnSelect("debitColumn", "Cargos (gastos)")}
                  {columnSelect("creditColumn", "Abonos (ingresos)")}
                </>
              )}
              <Field label="Separador decimal">
                <select
                  value={mapping.decimal}
                  onChange={(e) => set("decimal", e.target.value as ImportMapping["decimal"])}
                  className={inputClass}
                >
                  <option value=",">Coma (1.234,56)</option>
                  <option value=".">Punto (1,234.56)</option>
                </select>
              </Field>
              <label className="flex items-center gap-2 self-end pb-2.5 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  checked={mapping.invertSign}
                  onChange={(e) => set("invertSign", e.target.checked)}
                  className="accent-finance h-4 w-4"
                />
                Invertir signo (los gastos aparecen en positivo)
              </label>
            </div>
          </section>

          <section aria-labelledby="vista-previa">
            <h3 id="vista-previa" className="font-semibold">
              Vista previa
            </h3>
            <p className="text-muted mt-1 text-sm">
              {parsed.rows.length.toLocaleString("es-ES")} movimientos listos
              {parsed.errors.length > 0 && ` · ${parsed.errors.length} filas descartadas`}
            </p>
            {parsed.errors.length > 0 && (
              <ul className="text-attention mt-2 text-xs">
                {parsed.errors.slice(0, 5).map((e) => (
                  <li key={e.line}>
                    Fila {e.line}: {e.reason}
                  </li>
                ))}
                {parsed.errors.length > 5 && <li>y {parsed.errors.length - 5} más</li>}
              </ul>
            )}
            {parsed.rows.length > 0 && (
              <div className="relative mt-3 overflow-x-auto">
                <table className="w-full min-w-[480px] text-sm">
                  <thead className="text-muted text-left">
                    <tr>
                      <th className="py-1.5 font-medium">Fecha</th>
                      <th className="py-1.5 font-medium">Concepto</th>
                      <th className="py-1.5 text-right font-medium">Importe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.rows.slice(0, 8).map((r, i) => (
                      <tr key={i} className="border-border border-t">
                        <td className="text-muted py-1.5 tabular-nums">{r.booked_on}</td>
                        <td className="max-w-xs truncate py-1.5">{r.description}</td>
                        <td className="py-1.5 text-right tabular-nums">
                          {formatCents(r.amount_cents, account?.currency ?? "EUR", { signed: r.amount_cents > 0 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div className="flex flex-col gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={saveProfile}
                onChange={(e) => setSaveProfile(e.target.checked)}
                className="accent-finance h-4 w-4"
              />
              Guardar estas columnas como plantilla para esta cuenta
            </label>
            {saveProfile && (
              <Field label="Nombre de la plantilla (p. ej. el banco)" className="max-w-sm">
                <input
                  value={profileName}
                  maxLength={60}
                  onChange={(e) => setProfileName(e.target.value)}
                  className={inputClass}
                />
              </Field>
            )}
            <div>
              <button
                type="button"
                disabled={pending || parsed.rows.length === 0}
                onClick={submit}
                className={buttonClass.primary}
              >
                {pending ? "Importando…" : `Importar ${parsed.rows.length.toLocaleString("es-ES")} movimientos`}
              </button>
            </div>
          </div>
        </>
      )}

      {result && (
        <div
          role={result.ok ? "status" : "alert"}
          className="bg-surface-2 rounded-inner flex flex-col gap-1 px-4 py-3 text-sm"
        >
          {result.ok ? (
            <>
              <p className="text-finance font-semibold">Importación terminada</p>
              <p>
                {result.inserted} nuevos · {result.duplicates} ya estaban (duplicados) · {result.categorized}{" "}
                categorizados automáticamente
                {result.inserted ? ` (${Math.round(((result.categorized ?? 0) / result.inserted) * 100)} %)` : ""}
              </p>
              <Link href={`/finanzas/movimientos?cuenta=${accountId}`} className="text-text underline">
                Ver movimientos
              </Link>
            </>
          ) : (
            <p className="text-attention">{result.message}</p>
          )}
        </div>
      )}
    </div>
  );
}
