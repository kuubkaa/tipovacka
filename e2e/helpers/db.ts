import { randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

// Vlastní Prisma klient pro testy — připojuje se ke stejné databázi jako
// appka (DATABASE_URL z .env.local, načtené v playwright.config.ts).
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL není nastavena. Stáhni env proměnné: `npx vercel env pull .env.local`."
  );
}

export const testDb = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

/** Předpona testovacích dat — ať je v DB snadno poznáme a uklidíme. */
export const E2E_PREFIX = "[E2E]";

/** Předpona e-mailů testovacích účtů (podle ní probíhá záchranný úklid). */
const E2E_EMAIL_PREFIX = "e2e-";

export interface TestUser {
  id: string;
  email: string;
  name: string | null;
  isAdmin: boolean;
}

/**
 * Vytvoří testovacího uživatele přímo v DB.
 * - `name: null` → uživatel bez jména (stav hned po prvním přihlášení).
 * - `name` neuvedeno → dostane prefixované jméno `[E2E] <timestamp>`.
 */
export async function createTestUser(
  opts: { name?: string | null; isAdmin?: boolean } = {}
): Promise<TestUser> {
  const stamp = Date.now();
  const email = `${E2E_EMAIL_PREFIX}${stamp}-${randomUUID().slice(0, 8)}@example.test`;
  const name = opts.name === undefined ? `${E2E_PREFIX} ${stamp}` : opts.name;

  const user = await testDb.user.create({
    data: {
      email,
      name,
      isAdmin: opts.isAdmin ?? false,
      emailVerified: new Date(),
    },
  });

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    isAdmin: user.isAdmin,
  };
}

/**
 * Vytvoří databázovou session pro uživatele a vrátí její token.
 * Token se vkládá do cookie `authjs.session-token` (database session strategie).
 */
export async function createSessionToken(userId: string): Promise<string> {
  const sessionToken = randomUUID();
  await testDb.session.create({
    data: {
      userId,
      sessionToken,
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // +24 h
    },
  });
  return sessionToken;
}

/** Smaže uživatele (cascade smaže i jeho sessions, tipy a audit log). */
export async function deleteTestUser(userId: string): Promise<void> {
  await testDb.user.deleteMany({ where: { id: userId } });
}

/**
 * Záchranný úklid — smaže všechny zbylé E2E účty a jejich verifikační
 * tokeny. Volá se v global teardown pro případ, že nějaký test spadl
 * dřív, než stihl po sobě uklidit.
 */
export async function cleanupAllE2E(): Promise<void> {
  await testDb.user.deleteMany({
    where: { email: { startsWith: E2E_EMAIL_PREFIX } },
  });
  await testDb.verificationToken.deleteMany({
    where: { identifier: { startsWith: E2E_EMAIL_PREFIX } },
  });
}
