"use server";

import { db } from "@/lib/db";
import { recordTipChange } from "@/lib/tip-audit";

export type SaveGrantTipsResult =
  | { status: "ok"; saved: number }
  | { status: "expired" }
  | { status: "invalid" }
  | { status: "error"; message: string };

/**
 * Uloží tipy přes speciální „dotipovací" odkaz. Autorizuje pouze platný token
 * (TipEditGrant) — odkaz nevyžaduje přihlášení. Zapisuje se jen na zápasy
 * povolené v daném povolení a obchází běžný zámek fáze (to je smysl odkazu).
 *
 * FormData formát (jako běžný formulář):
 *   home_<matchId> = number nebo prázdné
 *   away_<matchId> = number nebo prázdné
 */
export async function saveGrantTipsAction(
  token: string,
  formData: FormData
): Promise<SaveGrantTipsResult> {
  try {
    return await saveGrantTips(token, formData);
  } catch (err) {
    console.error("[saveGrantTipsAction]", err);
    return {
      status: "error",
      message: "Něco se pokazilo při ukládání. Zkus to prosím za chvíli znovu.",
    };
  }
}

async function saveGrantTips(
  token: string,
  formData: FormData
): Promise<SaveGrantTipsResult> {
  const cleanToken = (token ?? "").trim();
  if (!cleanToken) return { status: "invalid" };

  const grant = await db.tipEditGrant.findUnique({
    where: { token: cleanToken },
    select: { userId: true, matchIds: true, expiresAt: true },
  });
  if (!grant) return { status: "invalid" };
  if (grant.expiresAt.getTime() <= Date.now()) return { status: "expired" };

  const allowed = new Set(grant.matchIds);
  const userId = grant.userId;

  // Posbírej páry (matchId, home, away) — jen pro povolené zápasy.
  const updates: Array<{ matchId: string; home: number; away: number }> = [];
  const seen = new Set<string>();
  for (const [key, raw] of formData.entries()) {
    if (typeof raw !== "string") continue;
    const m = key.match(/^home_(.+)$/);
    if (!m) continue;
    const matchId = m[1];
    if (seen.has(matchId)) continue;
    seen.add(matchId);
    if (!allowed.has(matchId)) continue;

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

  const existingTips = await db.tip.findMany({
    where: { userId, matchId: { in: [...allowed] } },
    select: { matchId: true, homeScore: true, awayScore: true },
  });
  const existingByMatch = new Map(existingTips.map((t) => [t.matchId, t]));

  let saved = 0;
  for (const u of updates) {
    const before = existingByMatch.get(u.matchId);
    await db.tip.upsert({
      where: { userId_matchId: { userId, matchId: u.matchId } },
      create: {
        userId,
        matchId: u.matchId,
        homeScore: u.home,
        awayScore: u.away,
      },
      update: { homeScore: u.home, awayScore: u.away },
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

  await db.tipEditGrant.update({
    where: { token: cleanToken },
    data: { usedAt: new Date() },
  });

  return { status: "ok", saved };
}
