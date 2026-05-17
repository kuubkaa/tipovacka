import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// V Prisma 7 se runtime connection string předává do driver adaptéru,
// ne do schéma. Používáme pooled URL (DATABASE_URL) — Neon má pgbouncer
// pooler vestavěný a serverless funkce zvládají burst trafficu lépe přes něj.
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL musí být nastavena. " +
      "Spusť `npx vercel env pull .env.local` nebo zkontroluj env proměnné."
  );
}

// Singleton vzor — v dev módu hot-reload Next.js by jinak vytvořil novou
// instanci PrismaClient (a tím nový connection pool) při každé změně souboru.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
