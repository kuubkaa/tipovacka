import { test, expect } from "./helpers/fixtures";

test.describe("Leaderboard", () => {
  test("přihlášený uživatel vidí stránku pořadí", async ({
    page,
    createUser,
    loginAs,
  }) => {
    const user = await createUser({ name: "[E2E] Divák" });
    await loginAs(user);

    await page.goto("/leaderboard");

    await expect(page).toHaveURL(/\/leaderboard/);
    await expect(
      page.getByRole("heading", { name: "Pořadí tipérů" })
    ).toBeVisible();
  });
});
