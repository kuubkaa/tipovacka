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
import { TipsForm, type SectionData } from "@/components/tips-form";
import { isDeadlinePassed, tournament } from "@/config/tournament";
import { db } from "@/lib/db";

const dateFormatter = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const KNOCKOUT_ORDER: Record<string, { idx: number; label: string }> = {
  ROUND_OF_32: { idx: 1, label: "Šestnáctifinále" },
  ROUND_OF_16: { idx: 2, label: "Osmifinále" },
  QUARTER_FINAL: { idx: 3, label: "Čtvrtfinále" },
  SEMI_FINAL: { idx: 4, label: "Semifinále" },
  THIRD_PLACE: { idx: 5, label: "O 3. místo" },
  FINAL: { idx: 6, label: "Finále" },
};

export default async function FormularPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/prihlaseni?callbackUrl=/formular");
  }

  const [matches, tips, teams, rankings, specialTips, knockoutAdvancers] =
    await Promise.all([
      db.match.findMany({
        include: {
          homeTeam: { select: { code: true, name: true, flagEmoji: true } },
          awayTeam: { select: { code: true, name: true, flagEmoji: true } },
        },
        orderBy: [{ stage: "asc" }, { group: "asc" }, { dateUtc: "asc" }],
      }),
      db.tip.findMany({
        where: { userId: session.user.id },
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

  const STAGE_TO_KEY: Record<string, string> = {
    ROUND_OF_32: "R32",
    ROUND_OF_16: "R16",
    QUARTER_FINAL: "QF",
    SEMI_FINAL: "SF",
    FINAL: "F",
  };

  const tipsByMatch = new Map(tips.map((t) => [t.matchId, t]));
  const now = new Date();
  const globalDeadlinePassed = isDeadlinePassed(now);

  // --- Skupinové zápasy → sekce „Skupina A..L" ---
  const groupMatchSections = new Map<string, typeof matches>();
  for (const m of matches) {
    if (m.stage !== "GROUP") continue;
    if (!m.homeTeam || !m.awayTeam) continue;
    const key = m.group ?? "?";
    const list = groupMatchSections.get(key) ?? [];
    list.push(m);
    groupMatchSections.set(key, list);
  }
  const groupSections: SectionData[] = Array.from(groupMatchSections.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([group, ms]) => ({
      label: `Skupina ${group}`,
      matches: ms.map((m) => ({
        id: m.id,
        matchKey: m.matchKey,
        dateIso: m.dateUtc.toISOString(),
        home: m.homeTeam!,
        away: m.awayTeam!,
        existingTip: tipsByMatch.get(m.id) ?? null,
        // Skupinová fáze: zamčená globálním deadlinem.
        locked: globalDeadlinePassed,
      })),
    }));

  // --- Vyřazovací zápasy → sekce po kolech (R32, R16, ČF, SF, F) ---
  const knockoutSectionsMap = new Map<string, typeof matches>();
  for (const m of matches) {
    if (m.stage === "GROUP") continue;
    if (!m.homeTeam || !m.awayTeam) continue;
    const list = knockoutSectionsMap.get(m.stage) ?? [];
    list.push(m);
    knockoutSectionsMap.set(m.stage, list);
  }
  const knockoutSections: SectionData[] = Array.from(
    knockoutSectionsMap.entries()
  )
    .sort(
      ([a], [b]) => (KNOCKOUT_ORDER[a]?.idx ?? 99) - (KNOCKOUT_ORDER[b]?.idx ?? 99)
    )
    .map(([stage, ms]) => ({
      label: KNOCKOUT_ORDER[stage]?.label ?? stage,
      matches: ms.map((m) => ({
        id: m.id,
        matchKey: m.matchKey,
        dateIso: m.dateUtc.toISOString(),
        home: m.homeTeam!,
        away: m.awayTeam!,
        existingTip: tipsByMatch.get(m.id) ?? null,
        // Per-zápas zámek: výkop proběhl
        locked: now >= m.dateUtc,
      })),
    }));

  const hasKnockoutMatches = knockoutSections.length > 0;

  // --- Pořadí skupin + králové střelců ---
  const teamsByGroup = new Map<string, typeof teams>();
  for (const t of teams) {
    if (!t.group) continue;
    const list = teamsByGroup.get(t.group) ?? [];
    list.push(t);
    teamsByGroup.set(t.group, list);
  }
  const rankingByGroup = new Map(rankings.map((r) => [r.group, r.teamCodes]));
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

  // --- Speciální tipy ---
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
              Zápasy
            </a>
            {hasKnockoutMatches && (
              <a
                href="#vyrazovaci-zapasy"
                className="text-slate-600 hover:text-slate-900"
              >
                Vyřazovací
              </a>
            )}
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
            globalDeadlinePassed
              ? "border-rose-200 bg-rose-50 text-rose-800"
              : "border-amber-200 bg-amber-50 text-amber-900"
          }`}
        >
          {globalDeadlinePassed ? (
            <p>
              <strong>Skupinový deadline uplynul</strong> ({" "}
              {dateFormatter.format(tournament.deadline)}). Tipy na skupinové
              zápasy + pořadí + speciální tipy jsou uzamčené. Vyřazovací zápasy
              lze tipovat individuálně do jejich výkopu.
            </p>
          ) : (
            <p>
              Tipy můžeš měnit do{" "}
              <strong>{dateFormatter.format(tournament.deadline)}</strong>. Po
              uzávěrce se zveřejní tipy všech a začne se bodovat. Vyřazovací
              fáze se odemkne postupně, jak admin přidává páry.
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
            disabled={globalDeadlinePassed}
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
          <SpecialTipsForm
            data={specialTipsData}
            disabled={globalDeadlinePassed}
          />
        </section>

        {/* Skupinové zápasy */}
        <section id="vysledky-zapasu" className="mb-12 scroll-mt-32">
          <div className="mb-4">
            <h2 className="text-lg font-bold tracking-tight">
              Zápasy ve skupinách
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Tipy na konkrétní skóre 72 zápasů základní fáze. Můžeš nechat
              prázdné — ty se neukládají.
            </p>
          </div>
          <TipsForm sections={groupSections} />
        </section>

        {/* Vyřazovací zápasy (zobrazí se až když admin doplní pavouka) */}
        {hasKnockoutMatches && (
          <section id="vyrazovaci-zapasy" className="scroll-mt-32">
            <div className="mb-4">
              <h2 className="text-lg font-bold tracking-tight">
                Vyřazovací zápasy
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Tipy na skóre konkrétních pávičkových zápasů. Každý zápas má
                vlastní deadline = výkop (po něm už nejde editovat).
              </p>
            </div>
            <TipsForm sections={knockoutSections} />
          </section>
        )}
      </main>
    </div>
  );
}
