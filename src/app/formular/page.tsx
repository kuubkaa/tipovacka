import { redirect } from "next/navigation";

import { auth } from "@/auth";
import {
  GroupRankingsForm,
  type GroupRankingData,
} from "@/components/group-rankings-form";
import {
  SpecialTipsForm,
  type SpecialTipsData,
} from "@/components/special-tips-form";
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

  const [matches, tips, teams, rankings, specialTips, knockoutAdvancers] =
    await Promise.all([
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
      db.team.findMany({
        where: { group: { not: null } },
        select: { code: true, name: true, flagEmoji: true, group: true },
        orderBy: { name: "asc" },
      }),
      db.groupRankingTip.findMany({
        where: { userId: session.user.id },
        select: { group: true, teamCodes: true },
      }),
      db.specialTip.findMany({
        where: { userId: session.user.id },
        select: { type: true, value: true },
      }),
      db.knockoutAdvancersTip.findMany({
        where: { userId: session.user.id },
        select: { stage: true, teamCodes: true },
      }),
    ]);

  // Mapování Stage enum -> klíč v UI (R32, R16, QF, SF, F)
  const STAGE_TO_KEY: Record<string, string> = {
    ROUND_OF_32: "R32",
    ROUND_OF_16: "R16",
    QUARTER_FINAL: "QF",
    SEMI_FINAL: "SF",
    FINAL: "F",
  };

  const tipsByMatch = new Map(tips.map((t) => [t.matchId, t]));
  const deadlinePassed = isDeadlinePassed();

  // --- Seskupit zápasy po skupinách (pro <TipsForm>) ---
  const matchGroups = new Map<string, typeof matches>();
  for (const m of matches) {
    const key = m.group ?? "?";
    const list = matchGroups.get(key) ?? [];
    list.push(m);
    matchGroups.set(key, list);
  }
  const matchGroupsSerialized = Array.from(matchGroups.entries())
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

  // --- Seskupit týmy po skupinách (pro <GroupRankingsForm>) ---
  const teamsByGroup = new Map<string, typeof teams>();
  for (const t of teams) {
    if (!t.group) continue;
    const list = teamsByGroup.get(t.group) ?? [];
    list.push(t);
    teamsByGroup.set(t.group, list);
  }
  const rankingByGroup = new Map(rankings.map((r) => [r.group, r.teamCodes]));
  // Mapa group letter -> jméno hráče (král střelců skupiny) z SpecialTip
  const scorerByGroup = new Map<string, string>();
  for (const st of specialTips) {
    const m = st.type.match(/^TOP_SCORER_GROUP_([A-L])$/);
    if (m) scorerByGroup.set(m[1], st.value);
  }
  const rankingGroups: GroupRankingData[] = Array.from(teamsByGroup.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([group, ts]) => ({
      group,
      teams: ts.map((t) => ({
        code: t.code,
        name: t.name,
        flagEmoji: t.flagEmoji,
      })),
      existingRanking: rankingByGroup.get(group as never) ?? null,
      existingScorer: scorerByGroup.get(group) ?? null,
    }));

  // --- Speciální tipy: připravit data pro form ---
  const existingAdvancers: Record<string, string[]> = {};
  for (const ka of knockoutAdvancers) {
    const key = STAGE_TO_KEY[ka.stage];
    if (key) existingAdvancers[key] = ka.teamCodes;
  }
  const specialTipsData: SpecialTipsData = {
    teams: teams.map((t) => ({
      code: t.code,
      name: t.name,
      flagEmoji: t.flagEmoji,
      group: t.group ?? "?",
    })),
    existing: Object.fromEntries(specialTips.map((s) => [s.type, s.value])),
    existingAdvancers,
  };

  return (
    <div className="flex flex-1 flex-col bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <div className="min-w-0">
            <a
              href="/"
              className="text-xs uppercase tracking-wider text-slate-500 hover:text-slate-700"
            >
              ← {tournament.shortName}
            </a>
            <h1 className="text-lg font-bold tracking-tight sm:text-xl">
              Vyplnit tipy
            </h1>
          </div>
          <div className="min-w-0 text-right text-xs text-slate-500">
            <p className="hidden sm:block">Přihlášen jako</p>
            <p
              className="truncate font-medium text-slate-700"
              title={session.user.email ?? ""}
            >
              {session.user.name ?? session.user.email}
            </p>
          </div>
        </div>
        <nav className="border-t border-slate-100 bg-white">
          <div className="mx-auto flex w-full max-w-3xl items-center gap-4 overflow-x-auto px-4 py-2 text-sm whitespace-nowrap sm:px-6">
            <a
              href="#poradi-skupin"
              className="text-slate-600 hover:text-slate-900"
            >
              Pořadí skupin
            </a>
            <a
              href="#specialni-tipy"
              className="text-slate-600 hover:text-slate-900"
            >
              Speciální tipy
            </a>
            <a
              href="#vysledky-zapasu"
              className="text-slate-600 hover:text-slate-900"
            >
              Výsledky zápasů
            </a>
            <a
              href="/leaderboard"
              className="ml-auto text-amber-700 hover:text-amber-900"
            >
              🏆 Pořadí
            </a>
          </div>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
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

        {/* Pořadí skupin */}
        <section id="poradi-skupin" className="mb-12 scroll-mt-32">
          <div className="mb-4">
            <h2 className="text-lg font-bold tracking-tight">
              Pořadí skupin
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              U každé skupiny vyber, kdo skončí na 1.–4. místě, a tipni jejího
              krále střelců. Každý tým můžeš v dané skupině zvolit jen jednou.
            </p>
          </div>
          <GroupRankingsForm
            groups={rankingGroups}
            disabled={deadlinePassed}
          />
        </section>

        {/* Speciální tipy */}
        <section id="specialni-tipy" className="mb-12 scroll-mt-32">
          <div className="mb-4">
            <h2 className="text-lg font-bold tracking-tight">Speciální tipy</h2>
            <p className="mt-1 text-sm text-slate-600">
              Postupující do vyřazovacích kol, vítěz turnaje a král střelců
              celého turnaje. Pole můžeš nechat prázdná — uloží se jen vyplněná.
            </p>
          </div>
          <SpecialTipsForm data={specialTipsData} disabled={deadlinePassed} />
        </section>

        {/* Výsledky zápasů */}
        <section id="vysledky-zapasu" className="scroll-mt-32">
          <div className="mb-4">
            <h2 className="text-lg font-bold tracking-tight">
              Výsledky zápasů ve skupinách
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Tipy na konkrétní skóre 72 zápasů základní fáze. Můžeš nechat
              prázdné — ty se neukládají.
            </p>
          </div>
          <TipsForm groups={matchGroupsSerialized} disabled={deadlinePassed} />
        </section>
      </main>
    </div>
  );
}
