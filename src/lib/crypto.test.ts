import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptToken, encryptToken } from "./crypto";

const key = randomBytes(32).toString("base64");

describe("cifrado de tokens", () => {
  it("cifra y descifra", () => {
    const token = encryptToken("1//refresh-token", key);
    expect(token).toMatch(/^v1\./);
    expect(token).not.toContain("refresh");
    expect(decryptToken(token, key)).toBe("1//refresh-token");
  });

  it("usa un IV distinto cada vez", () => {
    expect(encryptToken("x", key)).not.toBe(encryptToken("x", key));
  });

  it("falla con otra clave o datos alterados", () => {
    const token = encryptToken("secreto", key);
    expect(() => decryptToken(token, randomBytes(32).toString("base64"))).toThrow();
    const parts = token.split(".");
    parts[3] = Buffer.from("otro").toString("base64url");
    expect(() => decryptToken(parts.join("."), key)).toThrow();
  });

  it("rechaza claves que no son de 32 bytes", () => {
    expect(() => encryptToken("x", Buffer.from("corta").toString("base64"))).toThrow();
  });
});
