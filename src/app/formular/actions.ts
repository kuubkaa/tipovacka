"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { isDeadlinePassed } from "@/config/tournament";
import { db } from "@/lib/db";

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
