/**
 * Veřejná základní URL aplikace. Používá se pro stavbu absolutních odkazů
 * (pozvánky, dotipovací odkazy). Na Vercelu nastav `NEXT_PUBLIC_APP_URL`
 * nebo `AUTH_URL`; fallback je produkční doména.
 */
export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.AUTH_URL ??
  "https://tipovacka-phi.vercel.app";
