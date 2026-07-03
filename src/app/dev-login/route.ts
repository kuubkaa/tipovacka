import { NextResponse, type NextRequest } from "next/server";

import { PREVIEW_AUTOLOGIN_COOKIE } from "@/auth";

// Nastaví cookie s tajným klíčem pro auto-login na Vercel preview.
// Použití: otevři jednou `https://<preview-url>/dev-login?key=<PREVIEW_AUTOLOGIN_KEY>`.
// Od té chvíle je tenhle prohlížeč na preview automaticky přihlášený.
//
// BEZPEČNOST: funguje JEN na Vercel preview (VERCEL_ENV=preview). V produkci
// i lokálně vrací 404, takže cookie nikde jinde nenastaví.
export async function GET(req: NextRequest) {
  if (process.env.VERCEL_ENV !== "preview") {
    return new NextResponse("Not found", { status: 404 });
  }

  const key = process.env.PREVIEW_AUTOLOGIN_KEY?.trim();
  const provided = req.nextUrl.searchParams.get("key")?.trim();
  if (!key || !provided || provided !== key) {
    return new NextResponse("Neplatný klíč.", { status: 403 });
  }

  const res = NextResponse.redirect(new URL("/", req.url));
  res.cookies.set(PREVIEW_AUTOLOGIN_COOKIE, key, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 90, // 90 dní
  });
  return res;
}
