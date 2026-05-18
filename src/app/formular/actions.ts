"use server";

import { auth } from "@/auth";
import { isDeadlinePassed } from "@/config/tournament";
import { db } from "@/lib/db";

const GROUP_LETTERS = [
  "A", "B", "C", "D", "E", "F",
  "G", "H", "I", "J", "K", "L",
] as const;
type GroupLetter = (typeof GROUP_LETTERS)[number];

export type SaveTipsResult =
  | { status: "ok"; saved: number }
  | { status: "deadline" }
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
  const session = await auth();
  if (!session?.user?.id) {
    return { status: "unauth" };
  }

  if (isDeadlinePassed()) {
    return { status: "deadline" };
  }

  const userId = session.user.id;

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

    // Oba prázdné → nic neděláme (tip se neukládá)
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
      // Neúplný nebo nesmyslný tip — přeskoč. (Klient by měl validovat dopředu.)
      continue;
    }
    updates.push({ matchId, home, away });
  }

  // Ověř, že všechna matchId existují a jsou GROUP-fáze
  const matchIds = updates.map((u) => u.matchId);
  const validMatches = await db.match.findMany({
    where: { id: { in: matchIds }, stage: "GROUP" },
    select: { id: true },
  });
  const validIds = new Set(validMatches.map((m) => m.id));

  let saved = 0;
  for (const u of updates) {
    if (!validIds.has(u.matchId)) continue;
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
    saved++;
  }

  // Klient drží user-picked hodnoty v useState a po úspěšném save je
  // přemaže tím, co server potvrdil. Revalidaci stránky řešíme až při
  // přechodu jinam (uživatel může F5 udělat sám pro hard sync).
  return { status: "ok", saved };
}

// =============================================================================
// Pořadí skupin
// =============================================================================

export type SaveGroupRankingsResult =
  | { status: "ok"; saved: number; skipped: string[] }
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

    await db.groupRankingTip.upsert({
      where: { userId_group: { userId, group: group as GroupLetter } },
      create: { userId, group: group as GroupLetter, teamCodes: codes },
      update: { teamCodes: codes },
    });
    saved++;
  }

  // Klient drží user-picked hodnoty v useState a po úspěšném save je
  // přemaže tím, co server potvrdil. Revalidaci stránky řešíme až při
  // přechodu jinam (uživatel může F5 udělat sám pro hard sync).
  return { status: "ok", saved, skipped };
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

/// Vyřazovací kola, na která bere tipy "postupující": klíč v form data,
/// odpovídající `Stage` enum value, a počet týmů které do daného kola
/// postupují (jen pro UI counter — v DB neexistuje hard constraint).
export const KNOCKOUT_ADVANCERS_ROUNDS = [
  { key: "R32", stage: "ROUND_OF_32" as const, targetCount: 32, label: "Šestnáctifinále" },
  { key: "R16", stage: "ROUND_OF_16" as const, targetCount: 16, label: "Osmifinále" },
  { key: "QF", stage: "QUARTER_FINAL" as const, targetCount: 8, label: "Čtvrtfinále" },
  { key: "SF", stage: "SEMI_FINAL" as const, targetCount: 4, label: "Semifinále" },
  { key: "F", stage: "FINAL" as const, targetCount: 2, label: "Finále" },
] as const;

const SPECIAL_TIP_TYPES = [
  "TOURNAMENT_WINNER",
  "TOP_SCORER_TOURNAMENT",
  ...GROUP_LETTERS.map((g) => `TOP_SCORER_GROUP_${g}` as const),
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

  for (const type of SPECIAL_TIP_TYPES) {
    const raw = formData.get(`special_${type}`);
    const value = typeof raw === "string" ? raw.trim() : "";

    if (value === "") {
      const res = await db.specialTip.deleteMany({
        where: { userId, type },
      });
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
    saved++;
  }

  // --- Postupující do vyřazovacích kol ---
  let advancersSaved = 0;
  let advancersDeleted = 0;

  for (const round of KNOCKOUT_ADVANCERS_ROUNDS) {
    const raw = formData.getAll(`advancers_${round.key}`);
    // Vyfiltruj jen validní (existující) team codes a deduplikuj
    const codes = Array.from(
      new Set(
        raw
          .filter((v): v is string => typeof v === "string")
          .map((v) => v.trim())
          .filter((v) => v !== "" && validTeamCodes.has(v))
      )
    );

    if (codes.length === 0) {
      const res = await db.knockoutAdvancersTip.deleteMany({
        where: { userId, stage: round.stage },
      });
      advancersDeleted += res.count;
      continue;
    }

    await db.knockoutAdvancersTip.upsert({
      where: { userId_stage: { userId, stage: round.stage } },
      create: { userId, stage: round.stage, teamCodes: codes },
      update: { teamCodes: codes },
    });
    advancersSaved++;
  }

  return { status: "ok", saved, deleted, advancersSaved, advancersDeleted };
}
