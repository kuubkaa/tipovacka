import { redirect } from "next/navigation";

import { auth } from "@/auth";

/**
 * Vrátí session pro přihlášeného uživatele, jinak redirect na sign-in.
 * Pro použití v server komponentách / server actions.
 */
export async function requireSession(callbackUrl: string) {
  const session = await auth();
  if (!session?.user) {
    redirect(
      `/prihlaseni?callbackUrl=${encodeURIComponent(callbackUrl)}`
    );
  }
  return session;
}

/**
 * Stejné jako requireSession, ale uživatel musí mít vyplněné jméno.
 * Po prvním přihlášení je `name` null — takového uživatele pošleme
 * na /profil, ať si jméno doplní (a po uložení se vrátí na callbackUrl).
 */
export async function requireName(callbackUrl: string) {
  const session = await requireSession(callbackUrl);
  if (!session.user.name) {
    redirect(`/profil?next=${encodeURIComponent(callbackUrl)}`);
  }
  return session;
}

/**
 * Stejné jako requireSession, ale uživatel musí mít `isAdmin = true`.
 * Pokud je přihlášen ale není admin, redirect na "/" — zatím
 * bez separate "Access denied" stránky.
 */
export async function requireAdmin(callbackUrl: string) {
  const session = await requireSession(callbackUrl);
  if (!session.user.isAdmin) {
    redirect("/");
  }
  return session;
}
