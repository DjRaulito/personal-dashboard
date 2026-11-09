import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { googleConfigFrom, parseServerEnv } from "./server-env";

describe("variables de servidor", () => {
  const key = randomBytes(32).toString("base64");

  it("devuelve la configuración de Google cuando están todas", () => {
    const e = parseServerEnv({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "secret", TOKEN_ENCRYPTION_KEY: key });
    expect(googleConfigFrom(e)).toEqual({ clientId: "id", clientSecret: "secret", encryptionKey: key });
  });

  it("devuelve null si falta alguna (las vacías cuentan como ausentes)", () => {
    const e = parseServerEnv({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "", TOKEN_ENCRYPTION_KEY: key });
    expect(googleConfigFrom(e)).toBeNull();
  });

  it("rechaza una clave de cifrado con longitud incorrecta", () => {
    expect(() => parseServerEnv({ TOKEN_ENCRYPTION_KEY: "abc" })).toThrow();
  });
});
