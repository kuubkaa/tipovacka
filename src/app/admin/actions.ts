"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";

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
