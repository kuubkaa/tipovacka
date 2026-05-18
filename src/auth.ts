import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import { PrismaAdapter } from "@auth/prisma-adapter";

import { db } from "@/lib/db";

// V dev módu posíláme magic link do konzole (žádný email se neposílá),
// abychom mohli testovat bez Resend účtu. V produkci Resend pošle skutečný mail.
const isDev = process.env.NODE_ENV === "development";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(db),
  // Email magic-link nutně potřebuje databázové sessions (ne JWT).
  session: { strategy: "database" },
  callbacks: {
    // Auth.js defaultně neukládá user.id na session — přidáme ho ručně,
    // ať můžeme ve server komponentách a actions snadno dotahovat data k uživateli.
    session({ session, user }) {
      session.user.id = user.id;
      session.user.isAdmin = (user as { isAdmin?: boolean }).isAdmin ?? false;
      return session;
    },
  },
  providers: [
    Resend({
      // Defaultní Resend sender pro testy (bez ověřené domény).
      // V produkci po ověření vlastní domény přepíšeme přes env EMAIL_FROM.
      from: process.env.EMAIL_FROM ?? "onboarding@resend.dev",
      // V dev módu logujeme link místo posílání emailu.
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
