import { test as base } from "@playwright/test";

import {
  createSessionToken,
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "./db";

/** Jméno session cookie pro Auth.js v5 přes http (non-secure). */
const SESSION_COOKIE = "authjs.session-token";

type CreateUserOpts = { name?: string | null; isAdmin?: boolean };

interface Fixtures {
  /** Vytvoří testovacího uživatele; po skončení testu se automaticky smaže. */
  createUser: (opts?: CreateUserOpts) => Promise<TestUser>;
  /** Přihlásí aktuální browser context jako daného uživatele (nastaví cookie). */
  loginAs: (user: TestUser) => Promise<void>;
}

export const test = base.extend<Fixtures>({
  // eslint-disable-next-line no-empty-pattern -- fixture nepotřebuje žádné jiné fixtures
  createUser: async ({}, use) => {
    const createdIds: string[] = [];
    await use(async (opts = {}) => {
      const user = await createTestUser(opts);
      createdIds.push(user.id);
      return user;
    });
    // Teardown — uklidíme všechny uživatele vytvořené během testu.
    for (const id of createdIds) {
      await deleteTestUser(id);
    }
  },

  loginAs: async ({ context }, use) => {
    await use(async (user: TestUser) => {
      const token = await createSessionToken(user.id);
      await context.addCookies([
        {
          name: SESSION_COOKIE,
          value: token,
          domain: "localhost",
          path: "/",
          httpOnly: true,
          sameSite: "Lax",
        },
      ]);
    });
  },
});

export { expect } from "@playwright/test";
