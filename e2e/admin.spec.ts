import { test, expect } from "./helpers/fixtures";

test.describe("Admin přístup (jen autorizace, bez zápisu výsledků)", () => {
  test("běžný uživatel nemá přístup do /admin a je vrácen na úvod", async ({
    page,
    createUser,
    loginAs,
  }) => {
    const user = await createUser({ name: "[E2E] Běžný", isAdmin: false });
    await loginAs(user);

    await page.goto("/admin");

    // requireAdmin přesměruje neadmina na "/".
    await expect(page).not.toHaveURL(/\/admin/);
    await expect(
      page.getByRole("link", { name: "Vyplnit tipy" })
    ).toBeVisible();
  });

  test("admin vidí administrační rozhraní", async ({
    page,
    createUser,
    loginAs,
  }) => {
    const admin = await createUser({ name: "[E2E] Admin", isAdmin: true });
    await loginAs(admin);

    await page.goto("/admin");

    await expect(page).toHaveURL(/\/admin$/);
    await expect(
      page.getByRole("heading", { name: "Admin", level: 1 })
    ).toBeVisible();
  });
});
