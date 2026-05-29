import { cleanupAllE2E, testDb } from "./db";

/**
 * Spustí se jednou po doběhnutí všech testů. Smaže případné zbylé
 * [E2E] účty (kdyby nějaký test spadl před vlastním úklidem) a odpojí DB.
 */
export default async function globalTeardown() {
  await cleanupAllE2E();
  await testDb.$disconnect();
}
