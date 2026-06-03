import Link from "next/link";

import { tournament } from "@/config/tournament";
import { requireAdmin } from "@/lib/auth-guards";
import { db } from "@/lib/db";
import { KNOCKOUT_ADVANCERS_ROUNDS } from "@/lib/knockout-rounds";
import { cn } from "@/lib/utils";

const GROUP_LETTERS = [
  "A", "B", "C", "D", "E", "F",
  "G", "H", "I", "J", "K", "L",
] as const;

// Co se očekává v každé kategorii „kompletního" tipéra.
const SPECIAL_TOTAL = 2 + GROUP_LETTERS.length; // vítěz + král střelců turnaje + 12 skupin
const RANKING_TOTAL = GROUP_LETTERS.length; // 12 skupin
const ADVANCERS_TOTAL = KNOCKOUT_ADVANCERS_ROUNDS.length; // 6 kol

// Cílový počet týmů u jednotlivých postupových kol (R32 = 32 atd.).
const ADVANCERS_TARGET = new Map(
  KNOCKOUT_ADVANCERS_ROUNDS.map((r) => [r.stage as string, r.targetCount])
);

type Row = {
  userId: string;
  name: string;
  isAdmin: boolean;
  matches: number;
  rankings: number;
  specials: number;
  advancers: number;
};

export default async function AdminKontrolaPage() {
  const session = await requireAdmin("/admin/kontrola");

  // Hratelné zápasy = mají oba týmy (knockout placeholdery bez týmů nepočítáme).
  const tippableMatches = await db.match.findMany({
    where: { homeTeamId: { not: null }, awayTeamId: { not: null } },
    select: { id: true },
  });
  const tippableIds = tippableMatches.map((m) => m.id);
  const matchesTotal = tippableIds.length;

  const [users, matchCounts, rankings, specials, advancers] = await Promise.all([
    db.user.findMany({
      select: { id: true, name: true, email: true, isAdmin: true },
    }),
    db.tip.groupBy({
      by: ["userId"],
      where: { matchId: { in: tippableIds } },
      _count: { _all: true },
    }),
    db.groupRankingTip.findMany({
      select: { userId: true, teamCodes: true },
    }),
    db.specialTip.findMany({
      select: { userId: true, type: true, value: true },
    }),
    db.knockoutAdvancersTip.findMany({
      select: { userId: true, stage: true, teamCodes: true },
    }),
  ]);

  const matchByUser = new Map(matchCounts.map((c) => [c.userId, c._count._all]));

  // Pořadí skupin: započítáme jen kompletní (4 týmy).
  const rankingByUser = new Map<string, number>();
  for (const r of rankings) {
    if (r.teamCodes.length !== 4) continue;
    rankingByUser.set(r.userId, (rankingByUser.get(r.userId) ?? 0) + 1);
  }

  // Speciální tipy: vítěz, král střelců turnaje, 12 králů skupin — jen neprázdné.
  const SPECIAL_TYPES = new Set([
    "TOURNAMENT_WINNER",
    "TOP_SCORER_TOURNAMENT",
    ...GROUP_LETTERS.map((g) => `TOP_SCORER_GROUP_${g}`),
  ]);
  const specialByUser = new Map<string, number>();
  for (const s of specials) {
    if (!SPECIAL_TYPES.has(s.type)) continue;
    if (s.value.trim() === "") continue;
    specialByUser.set(s.userId, (specialByUser.get(s.userId) ?? 0) + 1);
  }

  // Postupující: kolo je hotové, když má přesně cílový počet týmů.
  const advancersByUser = new Map<string, number>();
  for (const a of advancers) {
    const target = ADVANCERS_TARGET.get(a.stage);
    if (target == null || a.teamCodes.length !== target) continue;
    advancersByUser.set(a.userId, (advancersByUser.get(a.userId) ?? 0) + 1);
  }

  const rows: Row[] = users.map((u) => ({
    userId: u.id,
    name: u.name ?? u.email ?? "(bez jména)",
    isAdmin: u.isAdmin,
    matches: matchByUser.get(u.id) ?? 0,
    rankings: rankingByUser.get(u.id) ?? 0,
    specials: specialByUser.get(u.id) ?? 0,
    advancers: advancersByUser.get(u.id) ?? 0,
  }));

  const perUserTotal = matchesTotal + RANKING_TOTAL + SPECIAL_TOTAL + ADVANCERS_TOTAL;
  const doneSum = (r: Row) =>
    r.matches + r.rankings + r.specials + r.advancers;
  const isComplete = (r: Row) =>
    r.matches >= matchesTotal &&
    r.rankings >= RANKING_TOTAL &&
    r.specials >= SPECIAL_TOTAL &&
    r.advancers >= ADVANCERS_TOTAL;

  // Nehotoví nahoru (nejvíc chybějících první), pak podle jména.
  rows.sort((a, b) => {
    const da = perUserTotal - doneSum(a);
    const db_ = perUserTotal - doneSum(b);
    if (da !== db_) return db_ - da;
    return a.name.localeCompare(b.name, "cs-CZ");
  });

  const completeCount = rows.filter(isComplete).length;

  return (
    <div className="flex flex-1 flex-col bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <div className="min-w-0">
            <Link
              href="/admin"
              className="text-xs uppercase tracking-wider text-slate-500 hover:text-slate-700"
            >
              ← Admin
            </Link>
            <h1 className="text-lg font-bold tracking-tight sm:text-xl">
              Kontrola vyplnění
            </h1>
          </div>
          <p className="text-xs text-slate-500">
            {tournament.shortName} ·{" "}
            <span className="font-medium text-slate-700">
              {session.user.name ?? session.user.email}
            </span>
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
          Přehled, kdo má vyplněno všechno. Zeleně = hotovo, oranžově = něco
          chybí, šedě = zatím nic.{" "}
          <span className="font-medium text-slate-800">
            {completeCount} / {rows.length}
          </span>{" "}
          tipérů má kompletně vyplněno.
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 font-semibold">Tipér</th>
                <th className="px-3 py-3 text-center font-semibold">Zápasy</th>
                <th className="px-3 py-3 text-center font-semibold">Pořadí</th>
                <th className="px-3 py-3 text-center font-semibold">Speciální</th>
                <th className="px-3 py-3 text-center font-semibold">Postupující</th>
                <th className="px-3 py-3 text-center font-semibold">Stav</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => {
                const complete = isComplete(r);
                return (
                  <tr key={r.userId} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-900">
                        {r.name}
                      </span>
                      {r.isAdmin && (
                        <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                          admin
                        </span>
                      )}
                    </td>
                    <CountCell done={r.matches} total={matchesTotal} />
                    <CountCell done={r.rankings} total={RANKING_TOTAL} />
                    <CountCell done={r.specials} total={SPECIAL_TOTAL} />
                    <CountCell done={r.advancers} total={ADVANCERS_TOTAL} />
                    <td className="px-3 py-3 text-center">
                      <span
                        className={cn(
                          "inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold",
                          complete
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                        )}
                      >
                        {complete
                          ? "Hotovo"
                          : `Chybí ${perUserTotal - doneSum(r)}`}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    Zatím žádní registrovaní tipéři.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs text-slate-500">
          Kompletní = {matchesTotal} zápasů · {RANKING_TOTAL} pořadí skupin ·{" "}
          {SPECIAL_TOTAL} speciálních tipů · {ADVANCERS_TOTAL} postupových kol.
        </p>
      </main>
    </div>
  );
}

function CountCell({ done, total }: { done: number; total: number }) {
  const complete = done >= total && total > 0;
  const empty = done === 0;
  return (
    <td className="px-3 py-3 text-center">
      <span
        className={cn(
          "font-medium tabular-nums",
          complete
            ? "text-emerald-700"
            : empty
              ? "text-slate-400"
              : "text-amber-700"
        )}
      >
        {done} / {total}
      </span>
    </td>
  );
}
