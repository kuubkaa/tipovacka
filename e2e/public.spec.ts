import { test, expect } from "./helpers/fixtures";

test.describe("Veřejné stránky", () => {
  test("úvodní stránka se načte s hlavními odkazy", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("link", { name: "Vyplnit tipy" })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Přihlásit se" })
    ).toBeVisible();
  });

  test("stránka s pravidly se načte", async ({ page }) => {
    await page.goto("/pravidla");
    await expect(
      page.getByRole("heading", { name: "Pravidla bodování", level: 1 })
    ).toBeVisible();
  });

  test("přihlašovací stránka má funkční formulář", async ({ page }) => {
    await page.goto("/prihlaseni");
    await expect(
      page.getByRole("heading", { name: "Přihlášení" })
    ).toBeVisible();
    await expect(page.locator("#email")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Pošli mi přihlašovací link" })
    ).toBeVisible();
  });
});
