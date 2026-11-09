import { expect, test } from "@playwright/test";

test("sin sesión, la portada redirige al login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page).toHaveTitle(/Entrar · Personal Dashboard/);
  await expect(page.getByRole("button", { name: "Continuar con Google" })).toBeVisible();
});

test("las rutas privadas también están protegidas", async ({ page }) => {
  for (const path of ["/calendario", "/ajustes", "/finanzas"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
  }
});

test("el login muestra el error de cuenta no autorizada", async ({ page }) => {
  await page.goto("/login?error=no_autorizado");
  await expect(page.getByRole("alert").filter({ hasText: "no tiene acceso" })).toBeVisible();
});
