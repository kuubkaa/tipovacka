import Link from "next/link";
import { Lock } from "lucide-react";

import { isDeadlinePassed, tournament } from "@/config/tournament";
import { requireSession } from "@/lib/auth-guards";
import { db } from "@/lib/db";
import { scoreMatchTip } from "@/lib/scoring";

const matchDateFormatter = new Intl.DateTimeFormat("cs-CZ", {
  weekday: "short",
  day: "numeric",
  month: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const deadlineDateFormatter = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function TipyPage() {
  const session = await requireSession("/tipy");
  const currentUserId = session.user.id;
  const deadlinePassed = isDeadlinePassed();

  // Před deadlinem ukážeme zámek
  if (!deadlinePassed) {
    return (
      <div className="flex flex-1 flex-col bg-slate-50 text-slate-900">
        <PageHeader title="Tipy všech" />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6">
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
            <div className="mx-auto mb-4 inline-flex size-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              <Lock className="size-5" />
            </div>
            <h2 className="text-lg font-semibold">Tipy jsou zamčené</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-slate-600">
              Po startu turnaje a uzávěrce tipů uvidíš tipy všech ostatních.
              Do té doby vidíš jen své vlastní v{" "}
              <Link
                href="/formular"
                className="font-medium text-slate-900 underline-offset-4 hover:underline"
              >
                formuláři
              </Link>
              .
            </p>
            <p className="mt-4 text-xs text-slate-500">
              Uzávěrka:{" "}
              <strong>
                {deadlineDateFormatter.format(tournament.deadline)}
              </strong>
            </p>
          </div>
        </main>
      </div>
    );
  }

  // Načti zápasy, tipy, uživatele
  const [matches, tips, users] = await Promise.all([
    db.match.findMany({
      where: { stage: "GROUP" },
      include: {
        homeTeam: { select: { code: true, name: true, flagEmoji: true } },
        awayTeam: { select: { code: true, name: true, flagEmoji: true } },
      },
      orderBy: [{ group: "asc" }, { dateUtc: "asc" }],
    }),
    db.tip.findMany({
      select: {
        userId: true,
        matchId: true,
        homeScore: true,
        awayScore: true,
      },
    }),
    db.user.findMany({
      select: { id: true, name: true, email: true },
    }),
  ]);

  const userById = new Map(users.map((u) => [u.id, u]));

  // Index tips by match
  const tipsByMatch = new Map<string, typeof tips>();
  for (const t of tips) {
    const list = tipsByMatch.get(t.matchId) ?? [];
    list.push(t);
    tipsByMatch.set(t.matchId, list);
  }

  // Seskup po skupinách
  const groups = new Map<string, typeof matches>();
  for (const m of matches) {
    const key = m.group ?? "?";
    const list = groups.get(key) ?? [];
    list.push(m);
    groups.set(key, list);
  }
  const orderedGroups = Array.from(groups.entries()).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  return (
    <div className="flex flex-1 flex-col bg-slate-50 text-slate-900">
      <PageHeader title="Tipy všech" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 text-sm text-slate-600">
          Tipy zápasů od všech hráčů. Body se počítají podle reálných výsledků
          (viz{" "}
          <Link
            href="/leaderboard"
            className="font-medium text-slate-900 underline-offset-4 hover:underline"
          >
            pořadí
          </Link>
          ).
        </div>

        <div className="space-y-10">
          {orderedGroups.map(([group, ms]) => (
            <section key={group}>
              <h2 className="mb-3 px-1 text-sm font-semibold uppercase tracking-wider text-slate-500">
                Skupina {group}
              </h2>
              <div className="space-y-3">
                {ms.map((m) => {
                  const matchTips = tipsByMatch.get(m.id) ?? [];
                  const hasResult =
                    m.homeScore !== null && m.awayScore !== null;
                  return (
                    <MatchCard
                      key={m.id}
                      match={{
                        date: new Date(m.dateUtc),
                        home: m.homeTeam!,
                        away: m.awayTeam!,
                        homeScore: m.homeScore,
                        awayScore: m.awayScore,
                      }}
                      tips={matchTips.map((t) => ({
                        userId: t.userId,
                        userName:
                          userById.get(t.userId)?.name ??
                          userById.get(t.userId)?.email ??
                          "?",
                        homeScore: t.homeScore,
                        awayScore: t.awayScore,
                        points: hasResult
                          ? scoreMatchTip(
                              t.homeScore,
                              t.awayScore,
                              m.homeScore!,
                              m.awayScore!
                            )
                          : null,
                      }))}
                      currentUserId={currentUserId}
                    />
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}

function PageHeader({ title }: { title: string }) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
        <div>
          <Link
            href="/"
            className="text-xs uppercase tracking-wider text-slate-500 hover:text-slate-700"
          >
            ← {tournament.shortName}
          </Link>
          <h1 className="text-lg font-bold tracking-tight sm:text-xl">
            {title}
          </h1>
        </div>
      </div>
    </header>
  );
}

interface MatchCardProps {
  match: {
    date: Date;
    home: { code: string; name: string; flagEmoji: string | null };
    away: { code: string; name: string; flagEmoji: string | null };
    homeScore: number | null;
    awayScore: number | null;
  };
  tips: Array<{
    userId: string;
    userName: string;
    homeScore: number;
    awayScore: number;
    points: number | null;
  }>;
  currentUserId: string;
}

function MatchCard({ match, tips, currentUserId }: MatchCardProps) {
  // Seřaď tipy: nejvyšší body první (pokud máme výsledek), jinak abecedně
  const sorted = [...tips].sort((a, b) => {
    if (a.points !== null && b.points !== null && a.points !== b.points) {
      return b.points - a.points;
    }
    return a.userName.localeCompare(b.userName, "cs-CZ");
  });

  const hasResult =
    match.homeScore !== null && match.awayScore !== null;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-4 py-3">
        <p className="mb-2 text-[11px] uppercase tracking-wide text-slate-400">
          {matchDateFormatter.format(match.date)}
        </p>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3">
          <div className="flex flex-col items-center gap-1 text-center">
            <span className="text-2xl leading-none">{match.home.flagEmoji}</span>
            <span className="text-sm font-medium leading-tight break-words">
              {match.home.name}
            </span>
          </div>
          <div className="flex flex-col items-center">
            {hasResult ? (
              <div className="rounded-lg bg-slate-900 px-3 py-1.5 text-base font-bold tabular-nums text-white">
                {match.homeScore} : {match.awayScore}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs text-slate-400">
                ještě nehrál
              </div>
            )}
          </div>
          <div className="flex flex-col items-center gap-1 text-center">
            <span className="text-2xl leading-none">{match.away.flagEmoji}</span>
            <span className="text-sm font-medium leading-tight break-words">
              {match.away.name}
            </span>
          </div>
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="px-4 py-3 text-center text-xs text-slate-400">
          Nikdo nepodal tip
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {sorted.map((t) => {
            const isMe = t.userId === currentUserId;
            return (
              <li
                key={t.userId}
                className={`flex items-center justify-between gap-3 px-4 py-2 text-sm ${
                  isMe ? "bg-amber-50" : ""
                }`}
              >
                <span
                  className={`truncate ${
                    isMe ? "font-semibold text-slate-900" : "text-slate-700"
                  }`}
                >
                  {t.userName}
                  {isMe && (
                    <span className="ml-1.5 text-xs text-amber-700">(ty)</span>
                  )}
                </span>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium tabular-nums text-slate-700">
                    {t.homeScore} : {t.awayScore}
                  </span>
                  {t.points !== null && (
                    <span
                      className={`w-8 text-right text-xs font-semibold tabular-nums ${
                        t.points > 0 ? "text-emerald-700" : "text-slate-400"
                      }`}
                    >
                      {t.points} b
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
