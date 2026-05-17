import { defineConfig } from "prisma/config";

// Konfigurace Prisma CLI (migrace, db push, studio).
// V Prisma 7 se connection string už nedává do schema.prisma — patří sem.
//
// Connection string se načítá z .env.local skrz npm scripty zabalené
// do `dotenv -e .env.local -- prisma …`. Pokud spustíš prisma CLI bez nich,
// proměnná nebude dostupná.
//
// Pro migrace používáme UNPOOLED URL (přímé spojení), protože pooled
// pgbouncer URL nepodporuje session-level příkazy potřebné pro migrace.
//
// Datasource přidáváme jen když je env nastavený — to umožní `prisma generate`
// běžet bez DB env vars (např. v `postinstall` při čerstvém npm install).
const databaseUrl = process.env.DATABASE_URL_UNPOOLED;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  ...(databaseUrl ? { datasource: { url: databaseUrl } } : {}),
});
