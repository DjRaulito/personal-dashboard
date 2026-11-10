import "server-only";
import { z } from "zod";
import { GoogleAuthError } from "./calendar";

// Google Drive con el permiso drive.file: la app solo ve los archivos y carpetas que crea ella.
// Los vídeos del VoiceStudio se guardan en la carpeta «VoiceStudio» de tu Drive.

const FOLDER_NAME = "VoiceStudio";
const FOLDER_MIME = "application/vnd.google-apps.folder";

async function drive(token: string, url: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(20000),
    cache: "no-store",
  });
  if (res.status === 401 || res.status === 403) {
    throw new GoogleAuthError(`Sin permiso para Google Drive (${res.status})`);
  }
  return res;
}

/** Carpeta «VoiceStudio» (la crea la primera vez). */
export async function ensureFolder(token: string): Promise<string> {
  const q = `name='${FOLDER_NAME}' and mimeType='${FOLDER_MIME}' and trashed=false`;
  const found = await drive(
    token,
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=1&spaces=drive`,
  );
  if (!found.ok) throw new Error(`Google Drive ${found.status}`);
  const { files } = z.object({ files: z.array(z.object({ id: z.string() })) }).parse(await found.json());
  if (files[0]) return files[0].id;

  const created = await drive(token, "https://www.googleapis.com/drive/v3/files?fields=id", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: FOLDER_MIME }),
  });
  if (!created.ok) throw new Error(`Google Drive ${created.status}`);
  return z.object({ id: z.string() }).parse(await created.json()).id;
}

/**
 * Sesión de subida reanudable: devuelve una URL a la que el montaje sube el archivo con un PUT, sin
 * necesitar el token (vale una semana). La respuesta final trae el id del archivo.
 */
export async function createUploadSession(
  token: string,
  folderId: string,
  name: string,
  mime: string,
): Promise<string> {
  const res = await drive(token, "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Type": mime },
    body: JSON.stringify({ name, parents: [folderId], mimeType: mime }),
  });
  const location = res.headers.get("location");
  if (!res.ok || !location) throw new Error(`Google Drive no abrió la subida (${res.status})`);
  return location;
}

export async function deleteDriveFile(token: string, id: string): Promise<void> {
  const res = await drive(token, `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 404) throw new Error(`Google Drive ${res.status}`);
}

export const driveViewUrl = (id: string) => `https://drive.google.com/file/d/${id}/view`;
export const drivePreviewUrl = (id: string) => `https://drive.google.com/file/d/${id}/preview`;
export const driveDownloadUrl = (id: string) => `https://drive.google.com/uc?export=download&id=${id}`;
export const driveThumbUrl = (id: string) => `https://drive.google.com/thumbnail?id=${id}&sz=w640`;
