import { expect, test } from "@playwright/test";

test("la portada carga y muestra los seis módulos", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Personal Dashboard/);
  await expect(page.getByRole("region", { name: "Módulos" }).getByRole("article")).toHaveCount(6);
});
