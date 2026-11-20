import "server-only";
import { extractText, getDocumentProxy } from "unpdf";
import type { createClient } from "@/lib/supabase/server";
import { downloadFile, findFolders, listPdfs } from "@/lib/google/drive";
import { parseBbvaStatement } from "./bbva-statement";
import { importHashes } from "./import-hash";
import { categorize, compileRules, type Rule } from "./rules";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export const STATEMENTS_FOLDER = "Extractos";

export interface SyncSummary {
  files: number;
  read: number;
  inserted: number;
  failed: string[];
}

/** Texto de cada página de un PDF. */
async function pdfPages(data: Uint8Array): Promise<string[]> {
  const pdf = await getDocumentProxy(data);
  const { text } = await extractText(pdf, { mergePages: false });
  return Array.isArray(text) ? text : [text];
}

/**
 * Lee la carpeta «Extractos» de Drive, abre solo los PDF que no se han leído antes y guarda sus
 * movimientos en la cuenta indicada, con categoría por reglas y sin duplicar.
 */
export async function syncStatements(supabase: Supabase, token: string, accountId: string): Promise<SyncSummary> {
  const folders = await findFolders(token, STATEMENTS_FOLDER);
  const files = (await Promise.all(folders.map((f) => listPdfs(token, f.id)))).flat();
  const { data: done } = await supabase.from("statement_files").select("drive_file_id");
  const seen = new Set((done ?? []).map((d) => d.drive_file_id));
  const pending = files.filter((f) => !seen.has(f.id)).slice(0, 24);

  const { data: ruleRows } = await supabase
    .from("rules")
    .select("id, pattern, match_type, amount_sign, category_id, priority");
  const rules = compileRules((ruleRows ?? []) as Rule[]);

  const summary: SyncSummary = { files: files.length, read: 0, inserted: 0, failed: [] };
  for (const file of pending) {
    try {
      const parsed = parseBbvaStatement(await pdfPages(await downloadFile(token, file.id)));
      if (!parsed) {
        summary.failed.push(file.name);
        continue;
      }
      const hashes = importHashes(accountId, parsed.rows);
      const records = parsed.rows.map((r, i) => ({
        ...r,
        account_id: accountId,
        source: "statement",
        import_hash: hashes[i],
        category_id: categorize(rules, r.description, r.amount_cents),
      }));
      let inserted = 0;
      if (records.length) {
        const { data, error } = await supabase
          .from("transactions")
          .upsert(records, { onConflict: "user_id,account_id,import_hash", ignoreDuplicates: true })
          .select("id");
        if (error) throw error;
        inserted = data.length;
      }
      await supabase.from("statement_files").insert({
        account_id: accountId,
        drive_file_id: file.id,
        name: file.name.slice(0, 300),
        period: parsed.period,
        rows_found: records.length,
        inserted,
      });
      summary.read += 1;
      summary.inserted += inserted;
    } catch (e) {
      console.error("[extractos]", file.id, e instanceof Error ? e.message : e);
      summary.failed.push(file.name);
    }
  }
  return summary;
}
