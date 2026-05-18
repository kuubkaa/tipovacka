"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { KNOCKOUT_ADVANCERS_ROUNDS } from "@/lib/knockout-rounds";

const GROUP_LETTERS = [
  "A", "B", "C", "D", "E", "F",
  "G", "H", "I", "J", "K", "L",
] as const;
type GroupLetter = (typeof GROUP_LETTERS)[number];

async function requireAdminSession() {
  const session = await auth();
  if (!session?.user?.id) return null;
  if (!session.user.isAdmin) return null;
  return session;
}

export type SaveMatchResultsResult =
  | { status: "ok"; updated: number; cleared: number }
  | { status: "unauth" }
  | { status: "forbidden" }
  | { status: "error"; message: string };

/**
 * Admin akce — zapíše skutečné skóre zápasům. Vyžaduje `isAdmin = true`.
 *
 * FormData formát:
 *   home_<matchId> = number nebo prázdné
 *   away_<matchId> = number nebo prázdné
 *
 * Pravidla:
 * - Vyplněné oba = update.
 * - Oba prázdné = NULL (admin odbral výsledek).
 * - Jen jeden vyplněný nebo neplatné číslo = přeskoč.
 */
export async function saveMatchResultsAction(
  _prev: SaveMatchResultsResult | null,
  formData: FormData
): Promise<SaveMatchResultsResult> {
  const session = await auth();
  if (!session?.user?.id) return { status: "unauth" };
  if (!session.user.isAdmin) return { status: "forbidden" };

  // Posbírej páry (matchId, home, away). Nepoužíváme deadline guard —
  // admin upravuje výsledky kdykoli.
  const ops: Array<{
    matchId: string;
    home: number | null;
    away: number | null;
  }> = [];
  const seen = new Set<string>();

  for (const [key] of formData.entries()) {
    const m = key.match(/^home_(.+)$/);
    if (!m) continue;
    const matchId = m[1];
    if (seen.has(matchId)) continue;
    seen.add(matchId);

    const homeStr = (formData.get(`home_${matchId}`) ?? "").toString().trim();
    const awayStr = (formData.get(`away_${matchId}`) ?? "").toString().trim();

    if (homeStr === "" && awayStr === "") {
      ops.push({ matchId, home: null, away: null });
      continue;
    }

    const home = Number(homeStr);
    const away = Number(awayStr);
    if (
      !Number.isInteger(home) ||
      !Number.isInteger(away) ||
      home < 0 ||
      away < 0 ||
      home > 99 ||
      away > 99
    ) {
      continue;
    }
    ops.push({ matchId, home, away });
  }

  // Ověř, že match IDs existují (proti podvržení formuláře)
  const matchIds = ops.map((o) => o.matchId);
  const validMatches = await db.match.findMany({
    where: { id: { in: matchIds } },
    select: { id: true, homeScore: true, awayScore: true },
  });
  const byId = new Map(validMatches.map((m) => [m.id, m]));

  let updated = 0;
  let cleared = 0;

  for (const op of ops) {
    const current = byId.get(op.matchId);
    if (!current) continue;

    if (op.home === null && op.away === null) {
      // Clear — jen pokud opravdu měl uložené skóre
      if (current.homeScore === null && current.awayScore === null) continue;
      await db.match.update({
        where: { id: op.matchId },
        data: { homeScore: null, awayScore: null },
      });
      cleared++;
    } else {
      // Pokud se hodnoty nemění, nepiš zbytečně
      if (
        current.homeScore === op.home &&
        current.awayScore === op.away
      ) {
        continue;
      }
      await db.match.update({
        where: { id: op.matchId },
        data: { homeScore: op.home, awayScore: op.away },
      });
      updated++;
    }
  }

  return { status: "ok", updated, cleared };
}

// =============================================================================
// Skupiny — pořadí + králové střelců (skutečné)
// =============================================================================

export type SaveGroupResultsResult =
  | {
      status: "ok";
      saved: number;
      skipped: string[];
      scorersSaved: number;
      scorersDeleted: number;
    }
  | { status: "unauth" }
  | { status: "forbidden" }
  | { status: "error"; message: string };

export async function saveGroupResultsAction(
  _prev: SaveGroupResultsResult | null,
  formData: FormData
): Promise<SaveGroupResultsResult> {
  const session = await requireAdminSession();
  if (!session) return { status: "forbidden" };

  const teams = await db.team.findMany({
    where: { group: { not: null } },
    select: { code: true, group: true },
  });
  const codesByGroup = new Map<string, Set<string>>();
  for (const t of teams) {
    if (!t.group) continue;
    const set = codesByGroup.get(t.group) ?? new Set<string>();
    set.add(t.code);
    codesByGroup.set(t.group, set);
  }

  const skipped: string[] = [];
  let saved = 0;

  for (const group of GROUP_LETTERS) {
    const codes = [
      formData.get(`group_${group}_pos1`),
      formData.get(`group_${group}_pos2`),
      formData.get(`group_${group}_pos3`),
      formData.get(`group_${group}_pos4`),
    ].map((v) => (typeof v === "string" ? v.trim() : ""));

    if (codes.every((c) => c === "")) {
      // Smaž existující result, pokud jsme ho předtím uložili
      await db.groupRankingResult.deleteMany({
        where: { group: group as GroupLetter },
      });
      continue;
    }

    const valid =
      codes.every((c) => c !== "") &&
      new Set(codes).size === 4 &&
      codes.every((c) => codesByGroup.get(group)?.has(c));

    if (!valid) {
      skipped.push(group);
      continue;
    }

    await db.groupRankingResult.upsert({
      where: { group: group as GroupLetter },
      create: { group: group as GroupLetter, teamCodes: codes },
      update: { teamCodes: codes },
    });
    saved++;
  }

  // Králové střelců skupin → TournamentResult s TOP_SCORER_GROUP_<X>
  let scorersSaved = 0;
  let scorersDeleted = 0;
  for (const group of GROUP_LETTERS) {
    const raw = formData.get(`group_${group}_scorer`);
    const value = typeof raw === "string" ? raw.trim() : "";
    const type = `TOP_SCORER_GROUP_${group}`;
    if (value === "") {
      const res = await db.tournamentResult.deleteMany({ where: { type } });
      scorersDeleted += res.count;
      continue;
    }
    if (value.length > 80) continue;
    await db.tournamentResult.upsert({
      where: { type },
      create: { type, value },
      update: { value },
    });
    scorersSaved++;
  }

  return { status: "ok", saved, skipped, scorersSaved, scorersDeleted };
}

// =============================================================================
// Postupující do vyřazovacích kol (skutečné)
// =============================================================================

export type SaveKnockoutResultsResult =
  | { status: "ok"; saved: number; cleared: number }
  | { status: "unauth" }
  | { status: "forbidden" }
  | { status: "error"; message: string };

export async function saveKnockoutResultsAction(
  _prev: SaveKnockoutResultsResult | null,
  formData: FormData
): Promise<SaveKnockoutResultsResult> {
  const session = await requireAdminSession();
  if (!session) return { status: "forbidden" };

  const validTeamCodes = new Set(
    (await db.team.findMany({ select: { code: true } })).map((t) => t.code)
  );

  let saved = 0;
  let cleared = 0;

  for (const round of KNOCKOUT_ADVANCERS_ROUNDS) {
    const raw = formData.getAll(`advancers_${round.key}`);
    const codes = Array.from(
      new Set(
        raw
          .filter((v): v is string => typeof v === "string")
          .map((v) => v.trim())
          .filter((v) => v !== "" && validTeamCodes.has(v))
      )
    );

    if (codes.length === 0) {
      const res = await db.knockoutAdvancersResult.deleteMany({
        where: { stage: round.stage },
      });
      cleared += res.count;
      continue;
    }

    await db.knockoutAdvancersResult.upsert({
      where: { stage: round.stage },
      create: { stage: round.stage, teamCodes: codes },
      update: { teamCodes: codes },
    });
    saved++;
  }

  return { status: "ok", saved, cleared };
}

// =============================================================================
// Speciální výsledky — vítěz turnaje + král střelců turnaje
// =============================================================================

export type SaveSpecialResultsResult =
  | { status: "ok"; saved: number; deleted: number }
  | { status: "unauth" }
  | { status: "forbidden" }
  | { status: "error"; message: string };

const SPECIAL_RESULT_TYPES = [
  "TOURNAMENT_WINNER",
  "TOP_SCORER_TOURNAMENT",
] as const;

export async function saveSpecialResultsAction(
  _prev: SaveSpecialResultsResult | null,
  formData: FormData
): Promise<SaveSpecialResultsResult> {
  const session = await requireAdminSession();
  if (!session) return { status: "forbidden" };

  const validTeamCodes = new Set(
    (await db.team.findMany({ select: { code: true } })).map((t) => t.code)
  );

  let saved = 0;
  let deleted = 0;

  for (const type of SPECIAL_RESULT_TYPES) {
    const raw = formData.get(`special_${type}`);
    const value = typeof raw === "string" ? raw.trim() : "";

    if (value === "") {
      const res = await db.tournamentResult.deleteMany({ where: { type } });
      deleted += res.count;
      continue;
    }

    if (type === "TOURNAMENT_WINNER") {
      if (!validTeamCodes.has(value)) continue;
    } else {
      if (value.length > 80) continue;
    }

    await db.tournamentResult.upsert({
      where: { type },
      create: { type, value },
      update: { value },
    });
    saved++;
  }

  return { status: "ok", saved, deleted };
}
