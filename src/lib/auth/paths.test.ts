import { describe, expect, it } from "vitest";
import { hasSupabaseAuthCookie, isPublicPath, loginErrorFromCallback } from "./paths";

describe("rutas públicas", () => {
  it("solo login y auth son públicas", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/auth/callback")).toBe(true);
    expect(isPublicPath("/")).toBe(false);
    expect(isPublicPath("/loginx")).toBe(false);
    expect(isPublicPath("/authors")).toBe(false);
    expect(isPublicPath("/ajustes")).toBe(false);
  });
});

describe("cookie de sesión", () => {
  it("detecta la cookie de Supabase, también troceada", () => {
    expect(hasSupabaseAuthCookie(["sb-abc-auth-token"])).toBe(true);
    expect(hasSupabaseAuthCookie(["sb-abc-auth-token.0"])).toBe(true);
    expect(hasSupabaseAuthCookie(["otra", "sb-abc-auth-token-code-verifier"])).toBe(false);
  });
});

describe("errores del callback", () => {
  it("un email fuera de la lista blanca es 'no_autorizado'", () => {
    const p = new URLSearchParams({ error: "server_error", error_description: "Database error saving new user" });
    expect(loginErrorFromCallback(p)).toBe("no_autorizado");
  });

  it("otros errores son genéricos y sin error no hay nada", () => {
    expect(loginErrorFromCallback(new URLSearchParams({ error: "access_denied" }))).toBe("auth");
    expect(loginErrorFromCallback(new URLSearchParams({ code: "x" }))).toBeNull();
  });
});
