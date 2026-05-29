import { test, expect } from "./helpers/fixtures";

test.describe("Profil (jméno uživatele)", () => {
  test("uživatel bez jména je z /formular poslán na /profil", async ({
    page,
    createUser,
    loginAs,
  }) => {
    const user = await createUser({ name: null });
    await loginAs(user);

    await page.goto("/formular");

    await expect(page).toHaveURL(/\/profil/);
    await expect(page.locator("#name")).toBeVisible();
  });

  test("uložení jména funguje a vrátí uživatele zpět na formulář", async ({
    page,
    createUser,
    loginAs,
  }) => {
    const user = await createUser({ name: null });
    await loginAs(user);

    await page.goto("/profil?next=/formular");
    await page.locator("#name").fill("[E2E] Tester");
    await page.getByRole("button", { name: "Uložit" }).click();

    // Po úspěšném uložení komponenta přesměruje na ?next (/formular).
    await expect(page).toHaveURL(/\/formular/);
    await expect(
      page.getByRole("heading", { name: "Vyplnit tipy" })
    ).toBeVisible();
  });
});
