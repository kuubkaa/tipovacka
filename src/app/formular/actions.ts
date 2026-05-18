"use server";

import { revalidatePath } from "next/cache";

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

  revalidatePath("/formular");
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

  revalidatePath("/formular");
  return { status: "ok", saved, skipped };
}
