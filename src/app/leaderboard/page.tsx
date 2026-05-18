import Link from "next/link";
import { Trophy } from "lucide-react";

import { tournament } from "@/config/tournament";
import { requireSession } from "@/lib/auth-guards";
import { SCORING, computeLeaderboard } from "@/lib/scoring";

export default async function LeaderboardPage() {
  await requireSession("/leaderboard");
  const rows = await computeLeaderboard();

  const tournamentStarted =
    rows.some((r) => r.total > 0) ||
    rows.some(
      (r) =>
        r.breakdown.matches > 0 ||
        r.breakdown.groupRanking > 0 ||
        r.breakdown.advancers > 0 ||
        r.breakdown.special > 0
    );

  return (
    <div className="flex flex-1 flex-col bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <div>
            <Link
              href="/"
              className="text-xs uppercase tracking-wider text-slate-500 hover:text-slate-700"
            >
              ← {tournament.shortName}
            </Link>
            <h1 className="text-lg font-bold tracking-tight sm:text-xl">
              Pořadí tipérů
            </h1>
          </div>
          <Trophy className="size-5 text-amber-500" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {!tournamentStarted && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Turnaj ještě nezačal nebo nebyly zadané žádné výsledky. Jakmile
            admin začne výsledky zadávat, body se objeví automaticky.
          </div>
        )}

        {rows.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            Zatím žádní tipéři.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2 text-center sm:w-16">Pořadí</th>
                  <th className="px-3 py-2">Tipér</th>
                  <th className="px-3 py-2 text-right sm:w-20">Body</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r, idx) => (
                  <Row key={r.userId} row={r} rank={idx + 1} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-6 text-xs text-slate-500">
          Body: přesné skóre = {SCORING.match.exact}, vítěz+rozdíl ={" "}
          {SCORING.match.winnerAndDiff}, jen vítěz ={" "}
          {SCORING.match.winnerOnly}; pořadí skupiny {SCORING.groupRanking.perPosition} b za pozici +{SCORING.groupRanking.perfectBonus} bonus;
          král střelců sk. = {SCORING.groupScorer}; postupy R32→F{" "}
          {SCORING.advancers.R32}·{SCORING.advancers.R16}·{SCORING.advancers.QF}·
          {SCORING.advancers.SF}·{SCORING.advancers.F}; vítěz turnaje ={" "}
          {SCORING.tournamentWinner}; král střelců turnaje ={" "}
          {SCORING.tournamentTopScorer}.
        </p>
      </main>
    </div>
  );
}

function Row({ row, rank }: { row: Awaited<ReturnType<typeof computeLeaderboard>>[number]; rank: number }) {
  const displayName = row.name ?? row.email;
  return (
    <tr>
      <td className="px-3 py-3 text-center font-semibold tabular-nums text-slate-700">
        {rank}.
      </td>
      <td className="px-3 py-3">
        <div className="font-medium text-slate-900">{displayName}</div>
        <div className="mt-0.5 text-xs text-slate-500">
          {row.breakdown.matches}z · {row.breakdown.groupRanking}sk ·{" "}
          {row.breakdown.groupScorers}kr · {row.breakdown.advancers}p ·{" "}
          {row.breakdown.special}sp
        </div>
      </td>
      <td className="px-3 py-3 text-right text-lg font-bold tabular-nums text-slate-900">
        {row.total}
      </td>
    </tr>
  );
}

