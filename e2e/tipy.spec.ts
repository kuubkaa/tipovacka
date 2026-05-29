import { test, expect } from "./helpers/fixtures";

test.describe("Ukládání tipů (kritická cesta)", () => {
  test("tip na skóre zápasu se uloží a přetrvá po znovunačtení", async ({
    page,
    createUser,
    loginAs,
  }) => {
    const user = await createUser({ name: "[E2E] Tipér" });
    await loginAs(user);

    await page.goto("/formular");
    await expect(
      page.getByRole("heading", { name: "Vyplnit tipy" })
    ).toBeVisible();

    // Vezmeme první (editovatelný) zápas ve skupinách a odvodíme jeho id
    // z atributu name (`home_<matchId>`), ať nejsme závislí na konkrétních týmech.
    const firstHome = page.locator('input[name^="home_"]:not([disabled])').first();
    await expect(firstHome).toBeVisible();
    const inputName = await firstHome.getAttribute("name");
    expect(inputName).toBeTruthy();
    const matchId = inputName!.replace("home_", "");

    await page.locator(`input[name="home_${matchId}"]`).fill("3");
    await page.locator(`input[name="away_${matchId}"]`).fill("1");

    // První tlačítko "Uložit tipy" patří sekci skupinových zápasů.
    await page.getByRole("button", { name: "Uložit tipy" }).first().click();
    await expect(page.getByText(/Uloženo \d+ tip/)).toBeVisible();

    // Reload — tip musí být pořád vyplněný (potvrzuje, že se opravdu uložil do DB).
    await page.reload();
    await expect(page.locator(`input[name="home_${matchId}"]`)).toHaveValue(
      "3"
    );
    await expect(page.locator(`input[name="away_${matchId}"]`)).toHaveValue(
      "1"
    );
  });
});
