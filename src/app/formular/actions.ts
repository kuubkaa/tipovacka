"use server";

import { auth } from "@/auth";
import { isDeadlinePassed } from "@/config/tournament";
import { db } from "@/lib/db";
import { KNOCKOUT_ADVANCERS_ROUNDS } from "@/lib/knockout-rounds";
import { recordTipChange } from "@/lib/tip-audit";

const GROUP_LETTERS = [
  "A", "B", "C", "D", "E", "F",
  "G", "H", "I", "J", "K", "L",
] as const;
type GroupLetter = (typeof GROUP_LETTERS)[number];

export type SaveTipsResult =
  | {
      status: "ok";
      saved: number;
      /** Počet tipů přeskočených kvůli uzamčenému zápasu
       *  (global deadline u skupin, výkop u vyřazovací fáze). */
      lockedSkipped: number;
    }
  | { status: "unauth" }
  | { status: "error"; message: string };

/**
 * Uloží tipy uživatele pro zápasy základní skupiny.
 *
 * FormData formát:
 *   home_<matchId> = number nebo prázdné
 *   away_<matchId> = number nebo prázdné
 *
 * Pro každý zápas s vyplněnými OBĚMA skóre se provede upsert.
 * Tipy s jen jedním vyplněným polem nebo s neplatným číslem jsou ignorovány.
 */
export async function saveTipsAction(
  _prev: SaveTipsResult | null,
  formData: FormData
): Promise<SaveTipsResult> {
  try {
    return await saveTips(formData);
  } catch (err) {
    console.error("[saveTipsAction]", err);
    return {
      status: "error",
      message: "Něco se pokazilo při ukládání. Zkus to prosím za chvíli znovu.",
    };
  }
}

async function saveTips(formData: FormData): Promise<SaveTipsResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { status: "unauth" };
  }

  const userId = session.user.id;
  const now = new Date();

  // Posbírej páry (matchId, home, away) z FormData
  const updates: Array<{ matchId: string; home: number; away: number }> = [];
  const seenMatches = new Set<string>();

  for (const [key, raw] of formData.entries()) {
    if (typeof raw !== "string") continue;
    const homeMatch = key.match(/^home_(.+)$/);
    if (!homeMatch) continue;
    const matchId = homeMatch[1];
    if (seenMatches.has(matchId)) continue;
    seenMatches.add(matchId);

    const homeStr = raw.trim();
    const awayStr = (formData.get(`away_${matchId}`) ?? "").toString().trim();

    if (homeStr === "" && awayStr === "") continue;

    const home = Number(homeStr);
    const away = Number(awayStr);
    if (
      !Number.isInteger(home) ||
      !Number.isInteger(away) ||
      home < 0 ||
      away < 0 ||
      home > 20 ||
      away > 20
    ) {
      continue;
    }
    updates.push({ matchId, home, away });
  }

  // Načti dotčené matche s dateUtc kvůli per-match deadline kontrole
  const matchIds = updates.map((u) => u.matchId);
  const validMatches = await db.match.findMany({
    where: { id: { in: matchIds } },
    select: { id: true, dateUtc: true },
  });
  const matchById = new Map(validMatches.map((m) => [m.id, m]));

  const existingTips = await db.tip.findMany({
    where: { userId, matchId: { in: matchIds } },
    select: { matchId: true, homeScore: true, awayScore: true },
  });
  const existingByMatch = new Map(existingTips.map((t) => [t.matchId, t]));

  let saved = 0;
  let lockedSkipped = 0;
  for (const u of updates) {
    const m = matchById.get(u.matchId);
    if (!m) continue; // Neznámý zápas

    // Per-zápas deadline = výkop (jednotně pro skupiny i vyřazovací).
    if (now >= m.dateUtc) {
      lockedSkipped++;
      continue;
    }

    const before = existingByMatch.get(u.matchId);
    await db.tip.upsert({
      where: { userId_matchId: { userId, matchId: u.matchId } },
      create: {
        userId,
        matchId: u.matchId,
        homeScore: u.home,
        awayScore: u.away,
      },
      update: {
        homeScore: u.home,
        awayScore: u.away,
      },
    });
    await recordTipChange({
      userId,
      entityType: "MATCH_TIP",
      entityKey: u.matchId,
      oldValue: before
        ? { homeScore: before.homeScore, awayScore: before.awayScore }
        : null,
      newValue: { homeScore: u.home, awayScore: u.away },
    });
    saved++;
  }

  return { status: "ok", saved, lockedSkipped };
}

// =============================================================================
// Pořadí skupin
// =============================================================================

export type SaveGroupRankingsResult =
  | {
      status: "ok";
      saved: number;
      skipped: string[];
      scorersSaved: number;
      scorersDeleted: number;
    }
  | { status: "deadline" }
  | { status: "unauth" }
  | { status: "error"; message: string };

/**
 * Uloží uživatelovy tipy na pořadí ve skupinách.
 *
 * FormData formát (per skupina):
 *   group_<A-L>_pos1 = team code (např. "MEX")
 *   group_<A-L>_pos2 = team code
 *   group_<A-L>_pos3 = team code
 *   group_<A-L>_pos4 = team code
 *
 * Pravidla:
 * - Pokud jsou všechny 4 pozice vyplněné a 4 různé týmy patří do dané skupiny,
 *   tip se uloží (upsert).
 * - Pokud je jakákoliv pozice prázdná nebo nesedí, skupina se přeskočí
 *   a její label se vrátí v `skipped`, aby UI mohlo zvýraznit problém.
 */
export async function saveGroupRankingsAction(
  _prev: SaveGroupRankingsResult | null,
  formData: FormData
): Promise<SaveGroupRankingsResult> {
  try {
    return await saveGroupRankings(formData);
  } catch (err) {
    console.error("[saveGroupRankingsAction]", err);
    return {
      status: "error",
      message: "Něco se pokazilo při ukládání. Zkus to prosím za chvíli znovu.",
    };
  }
}

async function saveGroupRankings(
  formData: FormData
): Promise<SaveGroupRankingsResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { status: "unauth" };
  }
  if (isDeadlinePassed()) {
    return { status: "deadline" };
  }

  const userId = session.user.id;

  // Předpočítáme team codes per skupinu z DB (validace)
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

  const existingRankings = await db.groupRankingTip.findMany({
    where: { userId },
    select: { group: true, teamCodes: true },
  });
  const rankingByGroup = new Map(existingRankings.map((r) => [r.group, r.teamCodes]));

  for (const group of GROUP_LETTERS) {
    const codes = [
      formData.get(`group_${group}_pos1`),
      formData.get(`group_${group}_pos2`),
      formData.get(`group_${group}_pos3`),
      formData.get(`group_${group}_pos4`),
    ].map((v) => (typeof v === "string" ? v.trim() : ""));

    // Pokud všechny prázdné → ignoruj skupinu (uživatel ji ještě nevyplnil)
    if (codes.every((c) => c === "")) continue;

    // Validace: 4 neprázdné, 4 unikátní, všechny patří do skupiny
    const valid =
      codes.every((c) => c !== "") &&
      new Set(codes).size === 4 &&
      codes.every((c) => codesByGroup.get(group)?.has(c));

    if (!valid) {
      skipped.push(group);
      continue;
    }

    const before = rankingByGroup.get(group as GroupLetter) ?? null;
    await db.groupRankingTip.upsert({
      where: { userId_group: { userId, group: group as GroupLetter } },
      create: { userId, group: group as GroupLetter, teamCodes: codes },
      update: { teamCodes: codes },
    });
    await recordTipChange({
      userId,
      entityType: "GROUP_RANKING",
      entityKey: group,
      oldValue: before ? { teamCodes: before } : null,
      newValue: { teamCodes: codes },
    });
    saved++;
  }

  // --- Králové střelců skupin (sdílí stejný form a save button) ---
  let scorersSaved = 0;
  let scorersDeleted = 0;
  const groupScorerTypes = GROUP_LETTERS.map((g) => `TOP_SCORER_GROUP_${g}`);
  const existingGroupScorers = await db.specialTip.findMany({
    where: { userId, type: { in: groupScorerTypes } },
    select: { type: true, value: true },
  });
  const scorerByType = new Map(existingGroupScorers.map((s) => [s.type, s.value]));
  for (const group of GROUP_LETTERS) {
    const raw = formData.get(`group_${group}_scorer`);
    const value = typeof raw === "string" ? raw.trim() : "";
    const type = `TOP_SCORER_GROUP_${group}`;
    const before = scorerByType.get(type);
    if (value === "") {
      const res = await db.specialTip.deleteMany({ where: { userId, type } });
      if (res.count > 0 && before !== undefined) {
        await recordTipChange({
          userId,
          entityType: "SPECIAL_TIP",
          entityKey: type,
          oldValue: { value: before },
          newValue: null,
        });
      }
      scorersDeleted += res.count;
      continue;
    }
    if (value.length > 80) continue;
    await db.specialTip.upsert({
      where: { userId_type: { userId, type } },
      create: { userId, type, value },
      update: { value },
    });
    await recordTipChange({
      userId,
      entityType: "SPECIAL_TIP",
      entityKey: type,
      oldValue: before !== undefined ? { value: before } : null,
      newValue: { value },
    });
    scorersSaved++;
  }

  return { status: "ok", saved, skipped, scorersSaved, scorersDeleted };
}

// =============================================================================
// Speciální tipy (vítěz turnaje, králové střelců)
// =============================================================================

export type SaveSpecialTipsResult =
  | {
      status: "ok";
      saved: number;
      deleted: number;
      advancersSaved: number;
      advancersDeleted: number;
    }
  | { status: "deadline" }
  | { status: "unauth" }
  | { status: "error"; message: string };

// KNOCKOUT_ADVANCERS_ROUNDS bydlí v src/lib/knockout-rounds.ts (sdílené
// mezi serverem a klientem; nesmí být v "use server" souboru).

// Pozn: TOP_SCORER_GROUP_<X> se ukládají v saveGroupRankingsAction
// (jsou v UI vedle pořadí dané skupiny). Tato action je nesahá.
const SPECIAL_TIP_TYPES = [
  "TOURNAMENT_WINNER",
  "TOP_SCORER_TOURNAMENT",
] as const;

const PLAYER_NAME_MAX = 80;

/**
 * Uloží speciální tipy: vítěz turnaje + 13 králů střelců (1 turnaj + 12 skupin).
 *
 * FormData formát:
 *   special_TOURNAMENT_WINNER          = team code (musí existovat v DB)
 *   special_TOP_SCORER_TOURNAMENT      = jméno hráče (free text)
 *   special_TOP_SCORER_GROUP_<A-L>     = jméno hráče (free text)
 *
 * Prázdná hodnota = tip smazat (pokud existuje).
 */
export async function saveSpecialTipsAction(
  _prev: SaveSpecialTipsResult | null,
  formData: FormData
): Promise<SaveSpecialTipsResult> {
  try {
    return await saveSpecialTips(formData);
  } catch (err) {
    console.error("[saveSpecialTipsAction]", err);
    return {
      status: "error",
      message: "Něco se pokazilo při ukládání. Zkus to prosím za chvíli znovu.",
    };
  }
}

async function saveSpecialTips(
  formData: FormData
): Promise<SaveSpecialTipsResult> {
  const session = await auth();
  if (!session?.user?.id) return { status: "unauth" };
  if (isDeadlinePassed()) return { status: "deadline" };

  const userId = session.user.id;

  // Pro validaci vítěze potřebujeme set platných team codes
  const validTeamCodes = new Set(
    (await db.team.findMany({ select: { code: true } })).map((t) => t.code)
  );

  let saved = 0;
  let deleted = 0;

  const existingSpecials = await db.specialTip.findMany({
    where: { userId, type: { in: [...SPECIAL_TIP_TYPES] } },
    select: { type: true, value: true },
  });
  const specialByType = new Map(existingSpecials.map((s) => [s.type, s.value]));

  for (const type of SPECIAL_TIP_TYPES) {
    const raw = formData.get(`special_${type}`);
    const value = typeof raw === "string" ? raw.trim() : "";
    const before = specialByType.get(type);

    if (value === "") {
      const res = await db.specialTip.deleteMany({
        where: { userId, type },
      });
      if (res.count > 0 && before !== undefined) {
        await recordTipChange({
          userId,
          entityType: "SPECIAL_TIP",
          entityKey: type,
          oldValue: { value: before },
          newValue: null,
        });
      }
      deleted += res.count;
      continue;
    }

    if (type === "TOURNAMENT_WINNER") {
      if (!validTeamCodes.has(value)) continue;
    } else {
      if (value.length > PLAYER_NAME_MAX) continue;
    }

    await db.specialTip.upsert({
      where: { userId_type: { userId, type } },
      create: { userId, type, value },
      update: { value },
    });
    await recordTipChange({
      userId,
      entityType: "SPECIAL_TIP",
      entityKey: type,
      oldValue: before !== undefined ? { value: before } : null,
      newValue: { value },
    });
    saved++;
  }

  // --- Postupující do vyřazovacích kol ---
  let advancersSaved = 0;
  let advancersDeleted = 0;

  const existingAdvancers = await db.knockoutAdvancersTip.findMany({
    where: { userId },
    select: { stage: true, teamCodes: true },
  });
  const advancersByStage = new Map(
    existingAdvancers.map((a) => [a.stage, a.teamCodes])
  );

  for (const round of KNOCKOUT_ADVANCERS_ROUNDS) {
    const raw = formData.getAll(`advancers_${round.key}`);
    // Vyfiltruj jen validní (existující) team codes, deduplikuj, ořež na max
    const codes = Array.from(
      new Set(
        raw
          .filter((v): v is string => typeof v === "string")
          .map((v) => v.trim())
          .filter((v) => v !== "" && validTeamCodes.has(v))
      )
    ).slice(0, round.targetCount); // server-side limit

    const before = advancersByStage.get(round.stage);

    if (codes.length === 0) {
      const res = await db.knockoutAdvancersTip.deleteMany({
        where: { userId, stage: round.stage },
      });
      if (res.count > 0 && before) {
        await recordTipChange({
          userId,
          entityType: "KNOCKOUT_ADVANCERS",
          entityKey: round.stage,
          oldValue: { teamCodes: before },
          newValue: null,
        });
      }
      advancersDeleted += res.count;
      continue;
    }

    await db.knockoutAdvancersTip.upsert({
      where: { userId_stage: { userId, stage: round.stage } },
      create: { userId, stage: round.stage, teamCodes: codes },
      update: { teamCodes: codes },
    });
    await recordTipChange({
      userId,
      entityType: "KNOCKOUT_ADVANCERS",
      entityKey: round.stage,
      oldValue: before ? { teamCodes: before } : null,
      newValue: { teamCodes: codes },
    });
    advancersSaved++;
  }

  return { status: "ok", saved, deleted, advancersSaved, advancersDeleted };
}
