import { db } from "@/lib/db";
import { KNOCKOUT_ADVANCERS_ROUNDS } from "@/lib/knockout-rounds";

/**
 * =============================================================================
 * Bodové schéma — zde se mění, jak se bodují tipy
 * =============================================================================
 *
 * Bodování zápasu je TIEROVANÉ (cascade) — každý zápas dostane body
 * z nejvyššího tieru, který sedí (NE součet). Pořadí od nejvyššího:
 *   1. exact            — přesné skóre
 *   2. winnerAndDiff    — správný vítěz/remíza + stejný gólový rozdíl
 *                         (remíza vždy spadne sem — rozdíl = 0)
 *   3. winnerOnly       — jen správný vítěz, jiný rozdíl (nikdy remíza)
 *   4. totalGoals       — vítěz špatně, ale stejný počet gólů celkem
 *   jinak 0.
 *
 * Maximum při všech tipech přesných a všech výsledcích zadaných:
 *   72 × 10 (zápasy)                  =  720
 *   12 × (4×2 + 7) (skupiny)          =  180
 *   12 × 20 (králové sk. střelců)     =  240
 *   advancers (32×10 + 16×20 + 8×30 + 4×40 + 2×50 + 2×50) = 1240
 *   60 + 50 (vítěz + střelec turnaje) =  110
 *   ───────────────────────────────────
 *   Celkem max:                       ≈ 2 480 b
 */
export const SCORING = {
  match: {
    /** Přesné skóre (např. tip 2:1, výsledek 2:1) */
    exact: 10,
    /** Správný vítěz/remíza a stejný gólový rozdíl (tip 2:1, výsledek 3:2) */
    winnerAndDiff: 6,
    /** Jen správný vítěz, jiný rozdíl (remíza spadne vždy do winnerAndDiff,
     *  protože tipy i výsledek mají rozdíl 0). */
    winnerOnly: 3,
    /** Útěcha: vítěz špatně, ale stejný celkový počet gólů (tip 3:0, real 1:2) */
    totalGoals: 1,
  },
  groupRanking: {
    /** 2 body za každou správně tipnutou pozici (1.–4. místo) */
    perPosition: 2,
    /** Bonus, pokud sedí všechny 4 pozice (2×4 + 7 = 15 b celkem) */
    perfectBonus: 7,
  },
  /** Body za správně tipnutého krále střelců skupiny */
  groupScorer: 20,
  /** Body za každý správně tipnutý postupující tým v daném kole */
  advancers: {
    R32: 10,
    R16: 20,
    QF: 30,
    SF: 40,
    BRONZ: 50,
    F: 50,
  },
  tournamentWinner: 60,
  tournamentTopScorer: 50,
} as const;

// =============================================================================
// Per-tip scoring functions (čisté funkce)
// =============================================================================

export function scoreMatchTip(
  tipHome: number,
  tipAway: number,
  realHome: number,
  realAway: number
): number {
  // 1) Exact
  if (tipHome === realHome && tipAway === realAway) {
    return SCORING.match.exact;
  }
  const tipSign = Math.sign(tipHome - tipAway);
  const realSign = Math.sign(realHome - realAway);
  if (tipSign === realSign) {
    // 2) Vítěz/remíza správně + stejný gólový rozdíl
    if (tipHome - tipAway === realHome - realAway) {
      return SCORING.match.winnerAndDiff;
    }
    // 3) Vítěz správně, jiný rozdíl
    return SCORING.match.winnerOnly;
  }
  // 4) Vítěz špatně, ale stejný celkový počet gólů — útěcha
  if (tipHome + tipAway === realHome + realAway) {
    return SCORING.match.totalGoals;
  }
  return 0;
}

export function scoreGroupRanking(
  tipCodes: string[] | null,
  realCodes: string[] | null
): number {
  if (!tipCodes || !realCodes) return 0;
  if (tipCodes.length < 4 || realCodes.length < 4) return 0;
  let pts = 0;
  let allMatch = true;
  for (let i = 0; i < 4; i++) {
    if (tipCodes[i] === realCodes[i]) {
      pts += SCORING.groupRanking.perPosition;
    } else {
      allMatch = false;
    }
  }
  if (allMatch) pts += SCORING.groupRanking.perfectBonus;
  return pts;
}

/**
 * Normalizace jména pro porovnání tipů: lowercase (cs-CZ),
 * strip diakritiky a sjednocení whitespace. "Mbappé" == "mbappe".
 */
export function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLocaleLowerCase("cs-CZ")
    .replace(/\s+/g, " ");
}

/**
 * Tip se počítá jako správný, pokud po normalizaci odpovídá `real` NEBO
 * libovolnému aliasu, který admin označil za platnou alternativu.
 */
export function scorePlayerName(
  tip: string | null | undefined,
  real: string | null | undefined,
  points: number,
  acceptedAliases: string[] = []
): number {
  if (!tip || !real) return 0;
  const t = normalizeName(tip);
  if (t === normalizeName(real)) return points;
  for (const alias of acceptedAliases) {
    if (alias && t === normalizeName(alias)) return points;
  }
  return 0;
}

export function scoreAdvancers(
  tipCodes: string[] | null,
  realCodes: string[] | null,
  pointsPerTeam: number
): number {
  if (!tipCodes || !realCodes || tipCodes.length === 0 || realCodes.length === 0) {
    return 0;
  }
  const realSet = new Set(realCodes);
  let pts = 0;
  for (const code of tipCodes) {
    if (realSet.has(code)) pts += pointsPerTeam;
  }
  return pts;
}

export function scoreTournamentWinner(
  tipCode: string | null | undefined,
  realCode: string | null | undefined
): number {
  if (!tipCode || !realCode) return 0;
  return tipCode === realCode ? SCORING.tournamentWinner : 0;
}

// =============================================================================
// Leaderboard
// =============================================================================

export interface LeaderboardRow {
  userId: string;
  name: string | null;
  email: string;
  total: number;
  /** Rozpad bodů podle kategorie */
  breakdown: {
    matches: number;
    groupRanking: number;
    groupScorers: number;
    advancers: number;
    special: number;
  };
}

/**
 * Spočítá leaderboard přes všechny uživatele. Pro typickou tipovačku
 * s desítkami uživatelů je in-memory výpočet rychlý a jednoduchý —
 * zde nepoužíváme cache, leaderboard je vždy přesný k aktuálním datům.
 */
export async function computeLeaderboard(): Promise<LeaderboardRow[]> {
  const [
    users,
    matches,
    matchTips,
    groupResults,
    groupRankings,
    knockoutResults,
    knockoutTips,
    tournamentResults,
    specialTips,
  ] = await Promise.all([
    db.user.findMany({
      select: { id: true, name: true, email: true },
      orderBy: { createdAt: "asc" },
    }),
    db.match.findMany({
      where: {
        stage: "GROUP",
        homeScore: { not: null },
        awayScore: { not: null },
      },
      select: { id: true, homeScore: true, awayScore: true },
    }),
    db.tip.findMany({
      select: {
        userId: true,
        matchId: true,
        homeScore: true,
        awayScore: true,
      },
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

  // Indexy pro rychlý lookup
  const matchById = new Map(matches.map((m) => [m.id, m]));
  const groupResultByGroup = new Map(
    groupResults.map((r) => [r.group, r.teamCodes])
  );
  const knockoutResultByStage = new Map(
    knockoutResults.map((r) => [r.stage, r.teamCodes])
  );
  const tournamentResultByType = new Map(
    tournamentResults.map((r) => [
      r.type,
      { value: r.value, aliases: r.acceptedAliases },
    ])
  );

  // Index tipů per user
  const matchTipsByUser = groupBy(matchTips, (t) => t.userId);
  const groupRankingsByUser = groupBy(groupRankings, (t) => t.userId);
  const knockoutTipsByUser = groupBy(knockoutTips, (t) => t.userId);
  const specialTipsByUser = groupBy(specialTips, (t) => t.userId);

  const rows: LeaderboardRow[] = users.map((u) => {
    let matchPts = 0;
    for (const t of matchTipsByUser.get(u.id) ?? []) {
      const m = matchById.get(t.matchId);
      if (!m || m.homeScore == null || m.awayScore == null) continue;
      matchPts += scoreMatchTip(
        t.homeScore,
        t.awayScore,
        m.homeScore,
        m.awayScore
      );
    }

    let groupRankingPts = 0;
    for (const t of groupRankingsByUser.get(u.id) ?? []) {
      groupRankingPts += scoreGroupRanking(
        t.teamCodes,
        groupResultByGroup.get(t.group) ?? null
      );
    }

    // Králové střelců skupin — SpecialTip s typem TOP_SCORER_GROUP_<X>
    let groupScorerPts = 0;
    for (const t of specialTipsByUser.get(u.id) ?? []) {
      if (!t.type.startsWith("TOP_SCORER_GROUP_")) continue;
      const real = tournamentResultByType.get(t.type);
      groupScorerPts += scorePlayerName(
        t.value,
        real?.value,
        SCORING.groupScorer,
        real?.aliases
      );
    }

    // Postupující do vyřazovacích kol
    let advancerPts = 0;
    for (const t of knockoutTipsByUser.get(u.id) ?? []) {
      const round = KNOCKOUT_ADVANCERS_ROUNDS.find((r) => r.stage === t.stage);
      if (!round) continue;
      const realCodes = knockoutResultByStage.get(t.stage) ?? null;
      const ppt = SCORING.advancers[round.key as keyof typeof SCORING.advancers];
      advancerPts += scoreAdvancers(t.teamCodes, realCodes, ppt);
    }

    // Vítěz turnaje + král střelců turnaje
    let specialPts = 0;
    for (const t of specialTipsByUser.get(u.id) ?? []) {
      if (t.type === "TOURNAMENT_WINNER") {
        specialPts += scoreTournamentWinner(
          t.value,
          tournamentResultByType.get(t.type)?.value
        );
      } else if (t.type === "TOP_SCORER_TOURNAMENT") {
        const real = tournamentResultByType.get(t.type);
        specialPts += scorePlayerName(
          t.value,
          real?.value,
          SCORING.tournamentTopScorer,
          real?.aliases
        );
      }
    }

    const total =
      matchPts + groupRankingPts + groupScorerPts + advancerPts + specialPts;

    return {
      userId: u.id,
      name: u.name,
      email: u.email,
      total,
      breakdown: {
        matches: matchPts,
        groupRanking: groupRankingPts,
        groupScorers: groupScorerPts,
        advancers: advancerPts,
        special: specialPts,
      },
    };
  });

  // Sort: total desc, pak jméno asc (pro stabilní pořadí při remíze)
  rows.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    return (a.name ?? a.email).localeCompare(b.name ?? b.email, "cs-CZ");
  });

  return rows;
}

// =============================================================================
// Util
// =============================================================================

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
