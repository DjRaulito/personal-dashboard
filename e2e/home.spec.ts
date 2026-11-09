import { expect, test } from "@playwright/test";

test("sin sesión, la portada redirige al login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page).toHaveTitle(/Entrar · Personal Dashboard/);
  await expect(page.getByRole("button", { name: "Continuar con Google" })).toBeVisible();
});

test("las rutas privadas también están protegidas", async ({ page }) => {
  for (const path of ["/calendario", "/ajustes", "/finanzas", "/finanzas/plan", "/gimnasio", "/nutricion"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
  }
});

test("el login muestra el error de cuenta no autorizada", async ({ page }) => {
  await page.goto("/login?error=no_autorizado");
  await expect(page.getByRole("alert").filter({ hasText: "no tiene acceso" })).toBeVisible();
});

test("el icono y el manifiesto se sirven sin sesión", async ({ page, request }) => {
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBe(true);
  expect((await manifest.json()).name).toBe("Personal Dashboard");
  for (const path of ["/favicon.ico", "/icon-192.png", "/icon-512.png"]) {
    const res = await request.get(path);
    expect(res.ok(), path).toBe(true);
  }
  await page.goto("/login");
  const icon = page.locator('link[rel="icon"][type="image/png"]');
  await expect(icon).toHaveAttribute("href", /\/icon\.png/);
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", /\/apple-icon\.png/);
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");
});
