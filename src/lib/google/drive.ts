import "server-only";
import { z } from "zod";
import { GoogleAuthError } from "./calendar";

// Lectura de Google Drive (solo lectura): los extractos del banco en PDF.

const API = "https://www.googleapis.com/drive/v3/files";

export interface DriveFile {
  id: string;
  name: string;
  modifiedTime: string;
}

const listSchema = z.object({
  files: z.array(z.object({ id: z.string(), name: z.string(), modifiedTime: z.string() })).default([]),
  nextPageToken: z.string().optional(),
});

async function drive(token: string, url: string): Promise<Response> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(30000),
    cache: "no-store",
  });
  if (res.status === 401) throw new GoogleAuthError("Google rechazó el acceso a Drive (401)");
  if (!res.ok) throw new Error(`Google Drive ${res.status}`);
  return res;
}

const quote = (s: string) => `'${s.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;

async function list(token: string, q: string): Promise<DriveFile[]> {
  const out: DriveFile[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      q,
      fields: "nextPageToken, files(id, name, modifiedTime)",
      pageSize: "200",
      orderBy: "modifiedTime",
      ...(pageToken ? { pageToken } : {}),
    });
    const page = listSchema.parse(await (await drive(token, `${API}?${params}`)).json());
    out.push(...page.files);
    pageToken = page.nextPageToken;
  } while (pageToken && out.length < 2000);
  return out;
}

/** Carpetas con ese nombre exacto (puede haber varias). */
export const findFolders = (token: string, name: string) =>
  list(token, `name = ${quote(name)} and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);

/** PDF que hay directamente dentro de la carpeta. */
export const listPdfs = (token: string, folderId: string) =>
  list(token, `${quote(folderId)} in parents and mimeType = 'application/pdf' and trashed = false`);

/** Contenido de un archivo (como mucho 10 MB). */
export async function downloadFile(token: string, id: string): Promise<Uint8Array> {
  const res = await drive(token, `${API}/${encodeURIComponent(id)}?alt=media`);
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength > 10 * 1024 * 1024) throw new Error("Archivo demasiado grande");
  return buf;
}
