import { createHash } from "node:crypto";
import { importKeys, type ParsedRow } from "./import";

/** Huellas SHA-256 por cuenta para el anti-duplicados (solo servidor). */
export function importHashes(accountId: string, rows: ParsedRow[]): string[] {
  return importKeys(rows).map((key) =>
    createHash("sha256").update(`${accountId}|${key}`).digest("base64url").slice(0, 32),
  );
}
