import Link from "next/link";

import { auth, signOut } from "@/auth";
import { tournament } from "@/config/tournament";

/** Která stránka je aktivní — kvůli zvýraznění + kontextovému odkazu na tipy. */
export type ActivePage =
  | "tipy-vlastni"
  | "tipy-vsech"
  | "leaderboard"
  | "pravidla"
  | "profil";

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={
        "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition-colors " +
        (active
          ? "bg-slate-900 text-white ring-slate-900"
          : "text-slate-700 ring-slate-300 hover:bg-slate-100")
      }
    >
      {children}
    </Link>
  );
}

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
        <nav className="flex items-center gap-1.5 overflow-x-auto">
          {active !== "tipy-vlastni" && (
            <NavLink href="/formular">Tvoje tipy</NavLink>
          )}
          {active !== "tipy-vsech" && <NavLink href="/tipy">Tipy všech</NavLink>}
          <NavLink href="/leaderboard" active={active === "leaderboard"}>
            Pořadí
          </NavLink>
          <NavLink href="/pravidla" active={active === "pravidla"}>
            Pravidla
          </NavLink>
          <NavLink href="/profil" active={active === "profil"}>
            Profil
          </NavLink>
          {user?.isAdmin && <NavLink href="/admin">Admin</NavLink>}
          {user && (
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button
                type="submit"
                className="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium text-slate-500 ring-1 ring-slate-300 hover:bg-slate-100"
              >
                Odhlásit
              </button>
            </form>
          )}
        </nav>
      </div>
      {children && (
        <div className="border-t border-slate-100 bg-white">{children}</div>
      )}
    </header>
  );
}
