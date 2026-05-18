import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { TipsForm } from "@/components/tips-form";
import { isDeadlinePassed, tournament } from "@/config/tournament";
import { db } from "@/lib/db";

const dateFormatter = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function FormularPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/prihlaseni?callbackUrl=/formular");
  }

  const [matches, tips] = await Promise.all([
    db.match.findMany({
      where: { stage: "GROUP" },
      include: {
        homeTeam: { select: { code: true, name: true, flagEmoji: true } },
        awayTeam: { select: { code: true, name: true, flagEmoji: true } },
      },
      orderBy: [{ group: "asc" }, { dateUtc: "asc" }],
    }),
    db.tip.findMany({
      where: {
        userId: session.user.id,
        match: { stage: "GROUP" },
      },
      select: { matchId: true, homeScore: true, awayScore: true },
    }),
  ]);

  const tipsByMatch = new Map(tips.map((t) => [t.matchId, t]));
  const deadlinePassed = isDeadlinePassed();

  // Seskupit zápasy po skupinách (A–L)
  const groups = new Map<string, typeof matches>();
  for (const m of matches) {
    const key = m.group ?? "?";
    const list = groups.get(key) ?? [];
    list.push(m);
    groups.set(key, list);
  }

  // Strip Prisma Date objekt na ISO string pro client komponent
  const groupedSerialized = Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([group, ms]) => ({
      group,
      matches: ms.map((m) => ({
        id: m.id,
        matchKey: m.matchKey,
        dateIso: m.dateUtc.toISOString(),
        home: m.homeTeam!,
        away: m.awayTeam!,
        existingTip: tipsByMatch.get(m.id) ?? null,
      })),
    }));

  return (
    <div className="flex flex-1 flex-col bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-6 py-4">
          <div>
            <a
              href="/"
              className="text-xs uppercase tracking-wider text-slate-500 hover:text-slate-700"
            >
              ← {tournament.shortName}
            </a>
            <h1 className="text-xl font-bold tracking-tight">Vyplnit tipy</h1>
          </div>
          <div className="text-right text-xs text-slate-500">
            <p>Přihlášen jako</p>
            <p className="font-medium text-slate-700">
              {session.user.name ?? session.user.email}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
        <div
          className={`mb-6 rounded-lg border p-4 text-sm ${
            deadlinePassed
              ? "border-rose-200 bg-rose-50 text-rose-800"
              : "border-amber-200 bg-amber-50 text-amber-900"
          }`}
        >
          {deadlinePassed ? (
            <p>
              <strong>Deadline uplynul.</strong> Tipy jsou zamčené —
              {" "}{dateFormatter.format(tournament.deadline)}.
            </p>
          ) : (
            <p>
              Tipy můžeš měnit do{" "}
              <strong>{dateFormatter.format(tournament.deadline)}</strong>. Po
              uzávěrce se zveřejní tipy všech a začne se bodovat.
            </p>
          )}
        </div>

        <TipsForm groups={groupedSerialized} disabled={deadlinePassed} />
      </main>
    </div>
  );
}
