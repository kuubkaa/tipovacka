import { test, expect } from "./helpers/fixtures";

test.describe("Přihlašování a ochrana stránek", () => {
  test("nepřihlášený uživatel je z /formular přesměrován na přihlášení", async ({
    page,
  }) => {
    await page.goto("/formular");
    await expect(page).toHaveURL(/\/prihlaseni/);
    await expect(
      page.getByRole("heading", { name: "Přihlášení" })
    ).toBeVisible();
  });

  test("nepřihlášený uživatel je z /leaderboard přesměrován na přihlášení", async ({
    page,
  }) => {
    await page.goto("/leaderboard");
    await expect(page).toHaveURL(/\/prihlaseni/);
  });

  test("odeslání e-mailu vede na stránku 'Zkontroluj email'", async ({
    page,
    createUser,
  }) => {
    // Vytvoříme účet jen kvůli e2e e-mailu (úklid pak smaže i jeho token).
    const user = await createUser({ name: null });

    await page.goto("/prihlaseni");
    await page.locator("#email").fill(user.email);
    await page
      .getByRole("button", { name: "Pošli mi přihlašovací link" })
      .click();

    // V dev módu se link jen vypíše do konzole, ale uživatel skončí na
    // potvrzovací stránce stejně jako v produkci. Auth.js servíruje náš
    // vlastní obsah na své interní adrese /api/auth/verify-request, proto
    // ověřujeme obsah stránky (nadpis), ne konkrétní URL.
    await expect(
      page.getByRole("heading", { name: "Zkontroluj email" })
    ).toBeVisible();
  });
});
