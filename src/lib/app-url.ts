import { headers } from "next/headers";

/**
 * Veřejná základní URL aplikace. Používá se pro stavbu absolutních odkazů
 * (pozvánky, dotipovací odkazy). Na Vercelu nastav `NEXT_PUBLIC_APP_URL`
 * nebo `AUTH_URL`; fallback je produkční doména.
 */
export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.AUTH_URL ??
  "https://tipovacka-phi.vercel.app";

/**
 * Základní URL podle aktuálního požadavku (host z hlaviček) — odkaz tak
 * ukazuje tam, kde právě běžíš (localhost / dev preview / produkce), ne na
 * napevno nastavenou doménu. Funguje jen v request scope (server action /
 * server komponenta); jinak spadne na `APP_URL`.
 */
export async function getAppOrigin(): Promise<string> {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (host) {
      const proto =
        h.get("x-forwarded-proto") ??
        (host.startsWith("localhost") || host.startsWith("127.0.0.1")
          ? "http"
          : "https");
      return `${proto}://${host}`;
    }
  } catch {
    // mimo request scope — použij fallback
  }
  return APP_URL;
}
