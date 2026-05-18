import Link from "next/link";
import { ArrowRight, CalendarClock, Trophy } from "lucide-react";

import { auth, signOut } from "@/auth";
import { buttonVariants } from "@/components/ui/button";
import { tournament, isDeadlinePassed } from "@/config/tournament";

const dateFormatter = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function Home() {
  const deadlinePassed = isDeadlinePassed();
  const session = await auth();

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-gradient-to-br from-indigo-950 via-slate-900 to-emerald-950 text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, rgba(99,102,241,0.35), transparent 45%), radial-gradient(circle at 80% 70%, rgba(16,185,129,0.30), transparent 50%)",
        }}
      />

      <header className="relative z-10 flex items-center justify-end px-6 py-4 text-sm">
        {session?.user ? (
          <div className="flex items-center gap-3 text-white/80">
            <span className="hidden sm:inline">
              Přihlášen jako{" "}
              <strong className="text-white">
                {session.user.name ?? session.user.email}
              </strong>
            </span>
            <Link
              href="/leaderboard"
              className="rounded-full px-3 py-1.5 text-xs font-medium text-white/80 ring-1 ring-white/20 hover:bg-white/10 hover:text-white"
            >
              Pořadí
            </Link>
            {session.user.isAdmin && (
              <Link
                href="/admin"
                className="rounded-full bg-amber-400/20 px-3 py-1.5 text-xs font-medium text-amber-200 ring-1 ring-amber-300/40 hover:bg-amber-400/30 hover:text-amber-100"
              >
                Admin
              </Link>
            )}
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button
                type="submit"
                className="rounded-full px-3 py-1.5 text-xs font-medium text-white/70 ring-1 ring-white/20 hover:bg-white/10 hover:text-white"
              >
                Odhlásit
              </button>
            </form>
          </div>
        ) : (
          <Link
            href="/prihlaseni"
            className="rounded-full px-3 py-1.5 text-xs font-medium text-white/70 ring-1 ring-white/20 hover:bg-white/10 hover:text-white"
          >
            Přihlásit se
          </Link>
        )}
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
        <div className="mb-8 inline-flex items-center justify-center rounded-full bg-white/10 p-5 text-white shadow-lg backdrop-blur-sm ring-1 ring-white/20">
          {/* Logo se bere z /public/logo.svg (viz tournament.config) */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={tournament.logoUrl}
            alt={`Logo ${tournament.shortName}`}
            width={72}
            height={72}
            className="size-16 text-amber-300"
            style={{ color: "#fbbf24" }}
          />
        </div>

        <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-white/80 ring-1 ring-white/20">
          <Trophy className="size-3.5" />
          Tipovací liga
        </p>

        <h1 className="max-w-3xl text-balance text-4xl font-bold leading-tight tracking-tight sm:text-5xl md:text-6xl">
          {tournament.name}
        </h1>

        <p className="mt-4 max-w-xl text-balance text-base text-white/70 sm:text-lg">
          {tournament.subtitle}
        </p>

        <div className="mt-8 inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm text-white/85 ring-1 ring-white/15">
          <CalendarClock className="size-4 text-amber-300" />
          {deadlinePassed ? (
            <span>
              Deadline pro tipy uzavřen ({dateFormatter.format(tournament.deadline)})
            </span>
          ) : (
            <span>
              Tipy můžeš vyplnit do{" "}
              <strong className="font-semibold text-white">
                {dateFormatter.format(tournament.deadline)}
              </strong>
            </span>
          )}
        </div>

        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
          <Link
            href="/formular"
            className={buttonVariants({
              size: "lg",
              className:
                "h-12 gap-2 rounded-full bg-amber-400 px-7 text-base font-semibold text-slate-950 hover:bg-amber-300",
            })}
          >
            Vyplnit tipy
            <ArrowRight className="size-4" />
          </Link>

          {deadlinePassed ? (
            <Link
              href="/tipy"
              className={buttonVariants({
                variant: "outline",
                size: "lg",
                className:
                  "h-12 rounded-full border-white/30 bg-white/5 px-6 text-base text-white hover:bg-white/15 hover:text-white",
              })}
            >
              Zobrazit tipy všech
            </Link>
          ) : (
            <Link
              href="/pravidla"
              className={buttonVariants({
                variant: "ghost",
                size: "lg",
                className:
                  "h-12 rounded-full px-6 text-base text-white/80 hover:bg-white/10 hover:text-white",
              })}
            >
              Jak se boduje
            </Link>
          )}
        </div>

        {!deadlinePassed && (
          <p className="mt-6 max-w-md text-sm text-white/55">
            Do uzávěrky vidí každý jen své tipy. Po startu turnaje se zveřejní
            tipy všech a začne se bodovat.
          </p>
        )}
      </main>

      <footer className="relative z-10 border-t border-white/10 px-6 py-5 text-center text-xs text-white/50">
        Pořádá {tournament.organizer} ·{" "}
        <a
          href={`mailto:${tournament.contactEmail}`}
          className="underline-offset-4 hover:text-white hover:underline"
        >
          {tournament.contactEmail}
        </a>
      </footer>
    </div>
  );
}
