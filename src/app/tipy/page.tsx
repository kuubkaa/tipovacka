import Link from "next/link";
import { Lock } from "lucide-react";

import { MatchCard } from "./match-card";
import { SiteHeader } from "@/components/site-header";
import { groupPhaseDeadline } from "@/lib/deadlines";
import { requireSession } from "@/lib/auth-guards";
import { db } from "@/lib/db";
import { KNOCKOUT_ADVANCERS_ROUNDS } from "@/lib/knockout-rounds";
import { PAGE_WIDTH } from "@/lib/layout";
import {
  SCORING,
  scoreAdvancers,
  scoreGroupRanking,
  scoreMatchTip,
  scorePlayerName,
  scoreTournamentWinner,
} from "@/lib/scoring";

const matchDateFormatter = new Intl.DateTimeFormat("cs-CZ", {
  weekday: "short",
  day: "numeric",
  month: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Prague",
});
// Klíč pro seskupení podle kalendářního dne (stabilní, řaditelný)
const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Europe/Prague",
});
// Nadpis dne v sekci Zápasy
const dayLabelFormatter = new Intl.DateTimeFormat("cs-CZ", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "Europe/Prague",
});
const deadlineDateFormatter = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Prague",
});

// Pořadí + názvy vyřazovacích kol (stejné jako ve formuláři).
const KNOCKOUT_ORDER: Record<string, { idx: number; label: string }> = {
  ROUND_OF_32: { idx: 1, label: "Šestnáctifinále" },
  ROUND_OF_16: { idx: 2, label: "Osmifinále" },
  QUARTER_FINAL: { idx: 3, label: "Čtvrtfinále" },
  SEMI_FINAL: { idx: 4, label: "Semifinále" },
  THIRD_PLACE: { idx: 5, label: "O 3. místo" },
  FINAL: { idx: 6, label: "Finále" },
};

export default async function TipyPage() {
  const session = await requireSession("/tipy");
  const currentUserId = session.user.id;
  const now = new Date();
  const groupDeadline = await groupPhaseDeadline();
  const deadlinePassed = now.getTime() >= groupDeadline.getTime();

  if (!deadlinePassed) {
    return (
      <div className="flex flex-1 flex-col bg-slate-50 text-slate-900">
        <SiteHeader active="tipy-vsech" />
        <main className={`mx-auto w-full ${PAGE_WIDTH} flex-1 px-4 py-12 sm:px-6`}>
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
                {deadlineDateFormatter.format(groupDeadline)}
              </strong>
            </p>
          </div>
        </main>
      </div>
    );
  }

  // Načti všechno potřebné paralelně
  const [
    matches,
    knockoutMatches,
    matchTips,
    users,
    teams,
    groupResults,
    groupTips,
    knockoutResults,
    knockoutTips,
    tournamentResults,
    specialTips,
  ] = await Promise.all([
    db.match.findMany({
      where: { stage: "GROUP" },
      include: {
        homeTeam: { select: { code: true, name: true, flagEmoji: true } },
        awayTeam: { select: { code: true, name: true, flagEmoji: true } },
      },
      orderBy: [{ dateUtc: "asc" }],
    }),
    db.match.findMany({
      where: { stage: { not: "GROUP" } },
      include: {
        homeTeam: { select: { code: true, name: true, flagEmoji: true } },
        awayTeam: { select: { code: true, name: true, flagEmoji: true } },
      },
      orderBy: [{ dateUtc: "asc" }],
    }),
    db.tip.findMany({
      select: { userId: true, matchId: true, homeScore: true, awayScore: true },
    }),
    db.user.findMany({
      select: { id: true, name: true, email: true },
    }),
    db.team.findMany({
      select: { code: true, name: true, flagEmoji: true, group: true },
    }),
    db.groupRankingResult.findMany({
      select: { group: true, teamCodes: true },
    }),
    db.groupRankingTip.findMany({
      select: { userId: true, group: true, teamCodes: true },
    }),
    db.knockoutAdvancersResult.findMany({
      select: { stage: true, teamCodes: true },
    }),
    db.knockoutAdvancersTip.findMany({
      select: { userId: true, stage: true, teamCodes: true },
    }),
    db.tournamentResult.findMany({
      select: { type: true, value: true, acceptedAliases: true },
    }),
    db.specialTip.findMany({
      select: { userId: true, type: true, value: true },
    }),
  ]);

  const userById = new Map(
    users.map((u) => [u.id, { name: u.name ?? u.email, email: u.email }])
  );
  const teamByCode = new Map(teams.map((t) => [t.code, t]));

  // Indexy. Prisma enumy zde caste-uju na string, ať můžu jako klíč
  // používat běžné string proměnné (GroupName/Stage je TS jen narrow string union).
  const tipsByMatch = groupBy(matchTips, (t) => t.matchId);
  const groupRankingResultByGroup = new Map<string, string[]>(
    groupResults.map((r) => [r.group as string, r.teamCodes])
  );
  const groupRankingTipsByGroup = groupBy(groupTips, (t) => t.group as string);
  const knockoutResultByStage = new Map<string, string[]>(
    knockoutResults.map((r) => [r.stage as string, r.teamCodes])
  );
  const knockoutTipsByStage = groupBy(knockoutTips, (t) => t.stage as string);
  const tournamentResultByType = new Map(
    tournamentResults.map((r) => [r.type, r.value])
  );
  const tournamentAliasesByType = new Map(
    tournamentResults.map((r) => [r.type, r.acceptedAliases])
  );
  const specialTipsByType = groupBy(specialTips, (t) => t.type);

  // Zápasy zobrazujeme chronologicky podle výkopu (orderBy v dotazu),
  // seskupené po dnech jen pro přehledné nadpisy.
  const matchDays = groupByPreservingOrder(matches, (m) =>
    dayKeyFormatter.format(new Date(m.dateUtc))
  );

  // --- Vyřazovací zápasy: seskup po kolech, odhal kolo až po výkopu jeho
  // prvního zápasu (stejný zámek jako ve formuláři). Tipy na skóre už máme
  // v `tipsByMatch` (dotaz na Tip není omezený na skupiny).
  const nowMs = now.getTime();
  const knockoutByStage = new Map<string, typeof knockoutMatches>();
  for (const m of knockoutMatches) {
    if (!m.homeTeam || !m.awayTeam) continue;
    const list = knockoutByStage.get(m.stage) ?? [];
    list.push(m);
    knockoutByStage.set(m.stage, list);
  }
  const revealedKnockoutRounds = Array.from(knockoutByStage.entries())
    .map(([stage, ms]) => ({
      stage,
      label: KNOCKOUT_ORDER[stage]?.label ?? stage,
      idx: KNOCKOUT_ORDER[stage]?.idx ?? 99,
      matches: ms,
      firstKickoffMs: Math.min(...ms.map((m) => m.dateUtc.getTime())),
    }))
    .filter((r) => nowMs >= r.firstKickoffMs)
    .sort((a, b) => a.idx - b.idx);
  const hasRevealedKnockout = revealedKnockoutRounds.length > 0;

  // Pro pořadí skupin: seznam skupin (z teams)
  const groupLetters = Array.from(
    new Set(
      teams
        .map((t) => t.group)
        .filter((g): g is NonNullable<typeof g> => g !== null)
        .map((g) => g as string)
    )
  ).sort();

  return (
    <div className="flex flex-1 flex-col bg-slate-50 text-slate-900">
      <SiteHeader active="tipy-vsech">
        <div className={`mx-auto flex w-full ${PAGE_WIDTH} gap-4 overflow-x-auto px-4 py-2 text-sm whitespace-nowrap sm:px-6`}>
          <a href="#zapasy" className="text-slate-600 hover:text-slate-900">
            Zápasy
          </a>
          {hasRevealedKnockout && (
            <a
              href="#vyrazovaci"
              className="text-slate-600 hover:text-slate-900"
            >
              Vyřazovací
            </a>
          )}
          <a href="#skupiny" className="text-slate-600 hover:text-slate-900">
            Pořadí skupin
          </a>
          <a href="#postupy" className="text-slate-600 hover:text-slate-900">
            Postupy
          </a>
          <a href="#specialni" className="text-slate-600 hover:text-slate-900">
            Speciální
          </a>
        </div>
      </SiteHeader>

      <main className={`mx-auto w-full ${PAGE_WIDTH} flex-1 px-4 py-6 sm:px-6 sm:py-8`}>
        <h1 className="mb-4 text-xl font-bold tracking-tight sm:text-2xl">
          Tipy všech
        </h1>
        {/* =================== Zápasy =================== */}
        <section id="zapasy" className="scroll-mt-32">
          <h2 className="mb-3 text-lg font-bold tracking-tight">Zápasy</h2>
          <div className="space-y-10">
            {matchDays.map(([dayKey, ms]) => (
              <div key={dayKey}>
                <h3 className="mb-3 px-1 text-sm font-semibold uppercase tracking-wider text-slate-500">
                  {dayLabelFormatter.format(new Date(ms[0].dateUtc))}
                </h3>
                <div className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {ms.map((m) => {
                    const mts = tipsByMatch.get(m.id) ?? [];
                    const hasResult =
                      m.homeScore !== null && m.awayScore !== null;
                    return (
                      <MatchCard
                        key={m.id}
                        dateLabel={matchDateFormatter.format(
                          new Date(m.dateUtc)
                        )}
                        home={m.homeTeam!}
                        away={m.awayTeam!}
                        homeScore={m.homeScore}
                        awayScore={m.awayScore}
                        tips={mts.map((t) => ({
                          userId: t.userId,
                          userName: userById.get(t.userId)?.name ?? "?",
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
              </div>
            ))}
          </div>
        </section>

        {/* =================== Vyřazovací zápasy =================== */}
        {hasRevealedKnockout && (
          <section id="vyrazovaci" className="mt-16 scroll-mt-32">
            <h2 className="mb-3 text-lg font-bold tracking-tight">
              Vyřazovací zápasy
            </h2>
            <div className="space-y-10">
              {revealedKnockoutRounds.map((round) => (
                <div key={round.stage}>
                  <h3 className="mb-3 px-1 text-sm font-semibold uppercase tracking-wider text-slate-500">
                    {round.label}
                  </h3>
                  <div className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {round.matches.map((m) => {
                      const mts = tipsByMatch.get(m.id) ?? [];
                      const hasResult =
                        m.homeScore !== null && m.awayScore !== null;
                      return (
                        <MatchCard
                          key={m.id}
                          dateLabel={matchDateFormatter.format(
                            new Date(m.dateUtc)
                          )}
                          home={m.homeTeam!}
                          away={m.awayTeam!}
                          homeScore={m.homeScore}
                          awayScore={m.awayScore}
                          tips={mts.map((t) => ({
                            userId: t.userId,
                            userName: userById.get(t.userId)?.name ?? "?",
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
                </div>
              ))}
            </div>
          </section>
        )}

        {/* =================== Pořadí skupin =================== */}
        <section id="skupiny" className="mt-16 scroll-mt-32">
          <h2 className="mb-3 text-lg font-bold tracking-tight">
            Pořadí skupin
          </h2>
          <div className="grid items-start gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {groupLetters.map((g) => {
              const realRanking = groupRankingResultByGroup.get(g) ?? null;
              const realScorer = tournamentResultByType.get(
                `TOP_SCORER_GROUP_${g}`
              );
              const realScorerAliases = tournamentAliasesByType.get(
                `TOP_SCORER_GROUP_${g}`
              );
              const userTips = groupRankingTipsByGroup.get(g) ?? [];
              const userScorers = specialTipsByType.get(
                `TOP_SCORER_GROUP_${g}`
              ) ?? [];
              const scorerByUser = new Map(
                userScorers.map((s) => [s.userId, s.value])
              );

              return (
                <GroupRankingCard
                  key={g}
                  group={g}
                  realRanking={realRanking}
                  realScorer={realScorer ?? null}
                  realScorerAliases={realScorerAliases ?? []}
                  tips={userTips.map((t) => ({
                    userId: t.userId,
                    userName: userById.get(t.userId)?.name ?? "?",
                    teamCodes: t.teamCodes,
                    scorer: scorerByUser.get(t.userId) ?? null,
                  }))}
                  teamByCode={teamByCode}
                  currentUserId={currentUserId}
                />
              );
            })}
          </div>
        </section>

        {/* =================== Postupující =================== */}
        <section id="postupy" className="mt-16 scroll-mt-32">
          <h2 className="mb-3 text-lg font-bold tracking-tight">Postupy</h2>
          <div className="grid items-start gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {KNOCKOUT_ADVANCERS_ROUNDS.map((round) => {
              const realCodes = knockoutResultByStage.get(round.stage) ?? null;
              const tips = knockoutTipsByStage.get(round.stage) ?? [];
              const pointsPerTeam =
                SCORING.advancers[round.key as keyof typeof SCORING.advancers];
              return (
                <AdvancersCard
                  key={round.key}
                  label={round.label}
                  targetCount={round.targetCount}
                  pointsPerTeam={pointsPerTeam}
                  realCodes={realCodes}
                  tips={tips.map((t) => ({
                    userId: t.userId,
                    userName: userById.get(t.userId)?.name ?? "?",
                    teamCodes: t.teamCodes,
                  }))}
                  teamByCode={teamByCode}
                  currentUserId={currentUserId}
                />
              );
            })}
          </div>
        </section>

        {/* =================== Speciální tipy =================== */}
        <section id="specialni" className="mt-16 scroll-mt-32">
          <h2 className="mb-3 text-lg font-bold tracking-tight">
            Speciální tipy
          </h2>
          <div className="grid items-start gap-4 lg:grid-cols-2 xl:grid-cols-3">
            <SpecialCard
              label="Vítěz turnaje"
              realValue={tournamentResultByType.get("TOURNAMENT_WINNER") ?? null}
              renderReal={(code) => formatTeam(code, teamByCode)}
              tips={(specialTipsByType.get("TOURNAMENT_WINNER") ?? []).map(
                (t) => ({
                  userId: t.userId,
                  userName: userById.get(t.userId)?.name ?? "?",
                  display: formatTeam(t.value, teamByCode),
                  points: scoreTournamentWinner(
                    t.value,
                    tournamentResultByType.get("TOURNAMENT_WINNER")
                  ),
                })
              )}
              currentUserId={currentUserId}
            />
            <SpecialCard
              label="Král střelců turnaje"
              realValue={
                tournamentResultByType.get("TOP_SCORER_TOURNAMENT") ?? null
              }
              renderReal={(v) => v}
              tips={(specialTipsByType.get("TOP_SCORER_TOURNAMENT") ?? []).map(
                (t) => ({
                  userId: t.userId,
                  userName: userById.get(t.userId)?.name ?? "?",
                  display: t.value,
                  points: scorePlayerName(
                    t.value,
                    tournamentResultByType.get("TOP_SCORER_TOURNAMENT"),
                    SCORING.tournamentTopScorer,
                    tournamentAliasesByType.get("TOP_SCORER_TOURNAMENT")
                  ),
                })
              )}
              currentUserId={currentUserId}
            />
          </div>
        </section>
      </main>
    </div>
  );
}

// =============================================================================
// Pomocné komponenty
// =============================================================================

interface TeamRef {
  code: string;
  name: string;
  flagEmoji: string | null;
}

function GroupRankingCard({
  group,
  realRanking,
  realScorer,
  realScorerAliases,
  tips,
  teamByCode,
  currentUserId,
}: {
  group: string;
  realRanking: string[] | null;
  realScorer: string | null;
  realScorerAliases: string[];
  tips: Array<{
    userId: string;
    userName: string;
    teamCodes: string[];
    scorer: string | null;
  }>;
  teamByCode: Map<string, TeamRef>;
  currentUserId: string;
}) {
  // Body per uživatel = pořadí + střelec
  const scored = tips.map((t) => {
    const rankingPts = scoreGroupRanking(t.teamCodes, realRanking);
    const scorerPts = scorePlayerName(
      t.scorer,
      realScorer,
      SCORING.groupScorer,
      realScorerAliases
    );
    return {
      ...t,
      rankingPts,
      scorerPts,
      total: rankingPts + scorerPts,
    };
  });
  scored.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    return a.userName.localeCompare(b.userName, "cs-CZ");
  });

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-700">
          Skupina {group}
        </h3>
        <div className="mt-2 text-xs text-slate-600">
          <p>
            <strong>Reálné pořadí: </strong>
            {realRanking ? (
              <span className="font-mono">
                {realRanking
                  .map(
                    (c, i) =>
                      `${i + 1}. ${formatTeam(c, teamByCode)}`
                  )
                  .join(" · ")}
              </span>
            ) : (
              <span className="text-slate-400">zatím nezadáno</span>
            )}
          </p>
          <p className="mt-0.5">
            <strong>Král střelců: </strong>
            {realScorer ? (
              <span>{realScorer}</span>
            ) : (
              <span className="text-slate-400">zatím nezadáno</span>
            )}
          </p>
        </div>
      </div>
      {scored.length === 0 ? (
        <p className="px-4 py-3 text-center text-xs text-slate-400">
          Nikdo netipoval
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {scored.map((t) => {
            const isMe = t.userId === currentUserId;
            return (
              <li
                key={t.userId}
                className={`px-4 py-2 text-sm ${isMe ? "bg-amber-50" : ""}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={`truncate ${
                      isMe ? "font-semibold text-slate-900" : "text-slate-700"
                    }`}
                  >
                    {t.userName}
                    {isMe && (
                      <span className="ml-1.5 text-xs text-amber-700">
                        (ty)
                      </span>
                    )}
                  </span>
                  <span
                    className={`shrink-0 text-xs font-semibold tabular-nums ${
                      t.total > 0 ? "text-emerald-700" : "text-slate-400"
                    }`}
                  >
                    {t.total} b
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  <span className="font-mono">
                    {t.teamCodes && t.teamCodes.length === 4
                      ? t.teamCodes
                          .map(
                            (c, i) => `${i + 1}. ${formatTeam(c, teamByCode)}`
                          )
                          .join(" · ")
                      : "(nevyplněno)"}
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Střelec:{" "}
                  {t.scorer ? (
                    <span className="text-slate-700">{t.scorer}</span>
                  ) : (
                    <span className="text-slate-400">(nevyplněno)</span>
                  )}
                  {realScorer && t.scorer && (
                    <span
                      className={`ml-1 font-semibold tabular-nums ${
                        t.scorerPts > 0 ? "text-emerald-700" : "text-slate-400"
                      }`}
                    >
                      (+{t.scorerPts} b)
                    </span>
                  )}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Seznam týmů jako zalamující se čipy „vlaječka + název". */
function TeamChipList({
  codes,
  teamByCode,
  className,
}: {
  codes: string[];
  teamByCode: Map<string, TeamRef>;
  className?: string;
}) {
  return (
    <span className={`flex flex-wrap gap-1 ${className ?? ""}`}>
      {codes.map((c, i) => {
        const t = teamByCode.get(c);
        return (
          <span
            key={`${c}-${i}`}
            className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-xs text-slate-900"
          >
            <span aria-hidden>{t?.flagEmoji ?? ""}</span>
            {/* Explicitní -webkit-text-fill-color: na iOS WebKitu jinak text
                „přebíral" barvu z vlajkového emoji a názvy byly barevné. */}
            <span style={{ color: "#0f172a", WebkitTextFillColor: "#0f172a" }}>
              {t?.name ?? c}
            </span>
          </span>
        );
      })}
    </span>
  );
}

function AdvancersCard({
  label,
  targetCount,
  pointsPerTeam,
  realCodes,
  tips,
  teamByCode,
  currentUserId,
}: {
  label: string;
  targetCount: number;
  pointsPerTeam: number;
  realCodes: string[] | null;
  tips: Array<{ userId: string; userName: string; teamCodes: string[] }>;
  teamByCode: Map<string, TeamRef>;
  currentUserId: string;
}) {
  const scored = tips.map((t) => ({
    ...t,
    points: scoreAdvancers(t.teamCodes, realCodes, pointsPerTeam),
    correctCount: realCodes
      ? t.teamCodes.filter((c) => realCodes.includes(c)).length
      : null,
  }));
  scored.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return a.userName.localeCompare(b.userName, "cs-CZ");
  });

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-700">
            {label}
          </h3>
          <span className="text-xs text-slate-500 tabular-nums">
            {pointsPerTeam} b / tým
          </span>
        </div>
        <div className="mt-1 text-xs text-slate-600">
          <strong>Reálně postoupili ({targetCount}):</strong>
          {realCodes && realCodes.length > 0 ? (
            <TeamChipList
              codes={realCodes}
              teamByCode={teamByCode}
              className="mt-1"
            />
          ) : (
            <span className="ml-1 text-slate-400">zatím nezadáno</span>
          )}
        </div>
      </div>
      {scored.length === 0 ? (
        <p className="px-4 py-3 text-center text-xs text-slate-400">
          Nikdo netipoval
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {scored.map((t) => {
            const isMe = t.userId === currentUserId;
            return (
              <li
                key={t.userId}
                className={`px-4 py-2 text-sm ${isMe ? "bg-amber-50" : ""}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={`truncate ${
                      isMe ? "font-semibold text-slate-900" : "text-slate-700"
                    }`}
                  >
                    {t.userName}
                    {isMe && (
                      <span className="ml-1.5 text-xs text-amber-700">
                        (ty)
                      </span>
                    )}
                  </span>
                  <div className="flex shrink-0 items-center gap-3 text-xs">
                    {t.correctCount !== null && (
                      <span className="text-slate-500 tabular-nums">
                        {t.correctCount} / {t.teamCodes.length}
                      </span>
                    )}
                    <span
                      className={`font-semibold tabular-nums ${
                        t.points > 0 ? "text-emerald-700" : "text-slate-400"
                      }`}
                    >
                      {t.points} b
                    </span>
                  </div>
                </div>
                {t.teamCodes.length > 0 ? (
                  <TeamChipList
                    codes={t.teamCodes}
                    teamByCode={teamByCode}
                    className="mt-1.5"
                  />
                ) : (
                  <p className="mt-1 text-xs text-slate-400">(nevyplněno)</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function SpecialCard({
  label,
  realValue,
  renderReal,
  tips,
  currentUserId,
}: {
  label: string;
  realValue: string | null;
  renderReal: (v: string) => string;
  tips: Array<{
    userId: string;
    userName: string;
    display: string;
    points: number;
  }>;
  currentUserId: string;
}) {
  const sorted = [...tips].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return a.userName.localeCompare(b.userName, "cs-CZ");
  });

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-700">
          {label}
        </h3>
        <p className="mt-1 text-sm">
          <strong>Reálně: </strong>
          {realValue ? (
            <span className="font-medium text-slate-900">
              {renderReal(realValue)}
            </span>
          ) : (
            <span className="text-slate-400">zatím nezadáno</span>
          )}
        </p>
      </div>
      {sorted.length === 0 ? (
        <p className="px-4 py-3 text-center text-xs text-slate-400">
          Nikdo netipoval
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
                <div className="flex shrink-0 items-center gap-3 text-xs">
                  <span className="text-slate-600">{t.display || "—"}</span>
                  <span
                    className={`font-semibold tabular-nums ${
                      t.points > 0 ? "text-emerald-700" : "text-slate-400"
                    }`}
                  >
                    {t.points} b
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// =============================================================================
// Util
// =============================================================================

function formatTeam(code: string, teamByCode: Map<string, TeamRef>): string {
  const t = teamByCode.get(code);
  if (!t) return code;
  return `${t.flagEmoji ?? ""} ${t.name}`.trim();
}

function groupBy<T, K>(arr: T[], key: (item: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const item of arr) {
    const k = key(item);
    const list = m.get(k) ?? [];
    list.push(item);
    m.set(k, list);
  }
  return m;
}

/**
 * Seskupí pole do dvojic [klíč, položky] a zachová pořadí prvního výskytu
 * klíče (vstup musí být předem seřazený — tady chronologicky podle výkopu).
 */
function groupByPreservingOrder<T>(
  arr: T[],
  key: (item: T) => string
): Array<[string, T[]]> {
  const m = new Map<string, T[]>();
  for (const item of arr) {
    const k = key(item);
    const list = m.get(k) ?? [];
    list.push(item);
    m.set(k, list);
  }
  return Array.from(m.entries());
}
