import NextAuth from "next-auth";
import type { Adapter, AdapterSession } from "next-auth/adapters";
import Nodemailer from "next-auth/providers/nodemailer";
import { PrismaAdapter } from "@auth/prisma-adapter";

import { db } from "@/lib/db";

// Prisma kód pro „záznam k operaci nenalezen".
function isRecordNotFound(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: unknown }).code === "P2025"
  );
}

// Adaptér s odolným mazáním session: když uživatel přijde se starou
// (expirovanou / ručně smazanou) session cookie a znovu se přihlásí,
// Auth.js se pokusí starou session smazat z DB. Pokud už neexistuje,
// `prisma.session.delete()` vyhodí P2025 a výchozí adaptér tím shodí
// celý login (chyba „Configuration"). Tady to tiše ignorujeme.
function makeResilientAdapter(): Adapter {
  const base = PrismaAdapter(db);
  return {
    ...base,
    deleteSession: async (sessionToken): Promise<AdapterSession | null> => {
      try {
        return (await base.deleteSession!(sessionToken)) as
          | AdapterSession
          | null;
      } catch (err) {
        if (isRecordNotFound(err)) return null;
        throw err;
      }
    },
  };
}

// V dev módu posíláme magic link do konzole (žádný email se neposílá),
// abychom mohli testovat lokálně bez SMTP. V produkci Nodemailer pošle
// skutečný mail přes Gmail SMTP (App Password).
const isDev = process.env.NODE_ENV === "development";

// SMTP config se čte z env vars (Vercel: Settings → Environment Variables).
// Hodnoty potřebné pro Gmail:
//   EMAIL_SERVER_HOST=smtp.gmail.com
//   EMAIL_SERVER_PORT=465
//   EMAIL_SERVER_USER=<tvoje>@gmail.com
//   EMAIL_SERVER_PASSWORD=<Gmail App Password, 16 znaků bez mezer>
//   EMAIL_FROM=Tipovačka MS 2026 <tvoje>@gmail.com
const emailServer = {
  host: process.env.EMAIL_SERVER_HOST ?? "",
  port: Number(process.env.EMAIL_SERVER_PORT ?? 587),
  secure: Number(process.env.EMAIL_SERVER_PORT ?? 587) === 465,
  auth: {
    user: process.env.EMAIL_SERVER_USER ?? "",
    pass: process.env.EMAIL_SERVER_PASSWORD ?? "",
  },
};

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: makeResilientAdapter(),
  session: { strategy: "database" },
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id;
      session.user.isAdmin = (user as { isAdmin?: boolean }).isAdmin ?? false;
      return session;
    },
  },
  providers: [
    Nodemailer({
      server: emailServer,
      from:
        process.env.EMAIL_FROM ??
        process.env.EMAIL_SERVER_USER ??
        "noreply@tipovacka.local",
      ...(isDev && {
        async sendVerificationRequest({ identifier, url }) {
          // eslint-disable-next-line no-console
          console.log(
            `\n========================================\n` +
              `📧 [DEV] Přihlašovací link pro ${identifier}:\n` +
              `   ${url}\n` +
              `========================================\n`
          );
        },
      }),
    }),
  ],
  pages: {
    signIn: "/prihlaseni",
    verifyRequest: "/zkontroluj-email",
  },
});
