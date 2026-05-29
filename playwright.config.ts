import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "node:path";

// E2E testy potřebují stejné env proměnné jako appka (hlavně DATABASE_URL
// a AUTH_SECRET) — načteme je z .env.local. Pokud soubor chybí, stáhni ho
// z Vercelu: `npx vercel env pull .env.local`. Viz e2e/README.md.
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// Testy běží na vlastním portu, ať nekolidují s `npm run dev` na 3000.
const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  globalTeardown: "./e2e/helpers/global-teardown.ts",
  // Sdílíme jednu databázi → testy běží sériově, ať se nepřekrývají.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? "list"
    : [["list"], ["html", { open: "never" }]],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    locale: "cs-CZ",
    timezoneId: "Europe/Prague",
    // Při pádu testu si uložíme trace pro snadné ladění (npx playwright show-trace).
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      // Předáme i rodičovské env (DATABASE_URL, AUTH_SECRET, PATH…) z .env.local.
      ...(process.env as Record<string, string>),
      // Vynutíme lokální auth URL — přebije produkční AUTH_URL z .env.local
      // a zajistí non-secure session cookie (`authjs.session-token`),
      // kterou testy nastavují.
      AUTH_URL: BASE_URL,
      AUTH_TRUST_HOST: "true",
    },
  },
});
