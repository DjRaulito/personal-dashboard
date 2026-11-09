import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Cifrado simétrico de tokens (AES-256-GCM). Formato: v1.<iv>.<tag>.<datos> en base64url.
const VERSION = "v1";

function toKey(base64Key: string): Buffer {
  const key = Buffer.from(base64Key, "base64");
  if (key.length !== 32) throw new Error("La clave de cifrado debe tener 32 bytes");
  return key;
}

export function encryptToken(plain: string, base64Key: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", toKey(base64Key), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), data.toString("base64url")].join(".");
}

export function decryptToken(token: string, base64Key: string): string {
  const [version, iv, tag, data] = token.split(".");
  if (version !== VERSION || !iv || !tag || data === undefined) throw new Error("Token cifrado con formato no válido");
  const decipher = createDecipheriv("aes-256-gcm", toKey(base64Key), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}
