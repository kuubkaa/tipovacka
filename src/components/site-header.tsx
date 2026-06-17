import Link from "next/link";

import { auth, signOut } from "@/auth";
import { SiteNav } from "@/components/site-nav";
import { tournament } from "@/config/tournament";

/** Která stránka je aktivní — kvůli zvýraznění + kontextovému odkazu na tipy. */
export type ActivePage =
  | "tipy-vlastni"
  | "tipy-vsech"
  | "leaderboard"
  | "pravidla"
  | "profil";

/**
 * Společná navigační lišta pro vnitřní stránky.
 *
 * `active` určuje zvýrazněnou položku a kontextový odkaz na tipy:
 * na „Tvoje tipy" se ukáže odkaz „Tipy všech" a naopak.
 * `children` (nepovinné) se vykreslí jako druhý řádek pod lištou
 * (např. kotvy sekcí formuláře nebo akce stránky).
 */
export async function SiteHeader({
  active,
  children,
}: {
  active?: ActivePage;
  children?: React.ReactNode;
}) {
  const session = await auth();
  const user = session?.user;

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur print:hidden">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        <Link
          href="/"
          className="shrink-0 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-800"
        >
          ← {tournament.shortName}
        </Link>
        <SiteNav
          active={active}
          isAdmin={!!user?.isAdmin}
          isLoggedIn={!!user}
          signOutAction={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        />
      </div>
      {children && (
        <div className="border-t border-slate-100 bg-white">{children}</div>
      )}
    </header>
  );
}
