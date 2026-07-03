import NextAuth from "next-auth";
import type { Session } from "next-auth";
import type { Adapter, AdapterSession } from "next-auth/adapters";
import Nodemailer from "next-auth/providers/nodemailer";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { cookies } from "next/headers";

import { db } from "@/lib/db";

// Jméno cookie, kterou nese tajný klíč pro auto-login na Vercel preview.
export const PREVIEW_AUTOLOGIN_COOKIE = "preview_autologin";

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

export const {
  handlers,
  signIn,
  signOut,
  auth: nextAuth,
} = NextAuth({
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

// ── Auto-login pro pohodlný vývoj ──────────────────────────────────────────
// Dva režimy, oba jen MIMO produkci:
//
//  1) Lokální `npm run dev` (NODE_ENV=development): stačí ve `.env.local`
//     nastavit `DEV_AUTOLOGIN_EMAIL=<email>`. Bez cookie, jen lokálně.
//
//  2) Vercel preview (VERCEL_ENV=preview): potřebuje `PREVIEW_AUTOLOGIN_EMAIL`
//     + tajný klíč `PREVIEW_AUTOLOGIN_KEY`. Aktivuje se AŽ když prohlížeč nese
//     cookie `preview_autologin` shodnou s klíčem — tu nastaví route
//     `/dev-login?key=<klíč>` (navštívíš ji jednou). Cizí návštěvník preview
//     URL cookie nemá → vidí normální login.
//
// BEZPEČNOST: v produkci (VERCEL_ENV=production) se ani jeden režim nikdy
// neaktivuje, i kdyby některá env var nějak unikla.
const isPreview = process.env.VERCEL_ENV === "preview";

const devAutoLoginEmail = isDev
  ? process.env.DEV_AUTOLOGIN_EMAIL?.trim() || undefined
  : undefined;

function sessionForUser(user: {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  isAdmin: boolean;
}): Session {
  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      isAdmin: user.isAdmin,
    },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

// Vrátí email pro preview auto-login, jen pokud jsme na preview a cookie nese
// správný tajný klíč. Jinak undefined.
async function previewAutoLoginEmail(): Promise<string | undefined> {
  if (!isPreview) return undefined;
  const email = process.env.PREVIEW_AUTOLOGIN_EMAIL?.trim();
  const key = process.env.PREVIEW_AUTOLOGIN_KEY?.trim();
  if (!email || !key) return undefined;

  const provided = (await cookies()).get(PREVIEW_AUTOLOGIN_COOKIE)?.value;
  return provided && provided === key ? email : undefined;
}

export const auth = async (): Promise<Session | null> => {
  const real = await nextAuth();
  if (real?.user) return real;

  const email = devAutoLoginEmail ?? (await previewAutoLoginEmail());
  if (!email) return real;

  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    // eslint-disable-next-line no-console
    console.warn(
      `[auto-login] Uživatel ${email} není v DB — ` +
        `přihlas se jednou přes magic link, pak už pojede automaticky.`
    );
    return real;
  }

  return sessionForUser(user);
};
