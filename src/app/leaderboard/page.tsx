import Link from "next/link";
import { Trophy } from "lucide-react";

import { PrintButton } from "@/components/print-button";
import { tournament } from "@/config/tournament";
import { requireSession } from "@/lib/auth-guards";
import { SCORING, computeLeaderboard } from "@/lib/scoring";

const printDateFormatter = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function LeaderboardPage() {
  await requireSession("/leaderboard");
  const rows = await computeLeaderboard();
  const printedAt = new Date();

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
    <div className="flex flex-1 flex-col bg-slate-50 text-slate-900 print:bg-white">
      <header className="border-b border-slate-200 bg-white print:hidden">
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
          <div className="flex items-center gap-3">
            <Link
              href="/leaderboard/prehled"
              className="rounded-full px-3 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100"
            >
              Kompletní přehled
            </Link>
            <PrintButton />
            <Trophy className="size-5 text-amber-500" />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6 sm:py-8 print:max-w-full print:px-0 print:py-0">
        {/* Tiskový header — zobrazí se jen při tisku */}
        <div className="mb-4 hidden print:block">
          <h1 className="text-2xl font-bold tracking-tight">
            {tournament.name} — Pořadí tipérů
          </h1>
          <p className="mt-1 text-xs text-slate-600">
            Vytištěno {printDateFormatter.format(printedAt)}
          </p>
        </div>

        {!tournamentStarted && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 print:hidden">
            Turnaj ještě nezačal nebo nebyly zadané žádné výsledky. Jakmile
            admin začne výsledky zadávat, body se objeví automaticky.
          </div>
        )}

        {rows.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            Zatím žádní tipéři.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white print:rounded-none print:border-slate-400">
            <table className="w-full text-sm print:text-base">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500 print:border-slate-400 print:bg-white print:text-slate-700">
                  <th className="px-3 py-2 text-center sm:w-16 print:w-12">
                    Pořadí
                  </th>
                  <th className="px-3 py-2">Tipér</th>
                  <th className="hidden px-3 py-2 text-right print:table-cell">
                    Zápasy
                  </th>
                  <th className="hidden px-3 py-2 text-right print:table-cell">
                    Skupiny
                  </th>
                  <th className="hidden px-3 py-2 text-right print:table-cell">
                    Střelci
                  </th>
                  <th className="hidden px-3 py-2 text-right print:table-cell">
                    Postupy
                  </th>
                  <th className="hidden px-3 py-2 text-right print:table-cell">
                    Speciál
                  </th>
                  <th className="px-3 py-2 text-right sm:w-20 print:w-16">
                    Body
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 print:divide-slate-300">
                {rows.map((r, idx) => (
                  <Row key={r.userId} row={r} rank={idx + 1} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-6 space-y-1 text-xs text-slate-500 print:mt-4 print:text-slate-600">
          <p>
            <strong className="text-slate-700">Zápas (cascade):</strong>{" "}
            přesné skóre {SCORING.match.exact} · vítěz/remíza + gólový rozdíl{" "}
            {SCORING.match.winnerAndDiff} · jen vítěz{" "}
            {SCORING.match.winnerOnly} · jen počet gólů celkem{" "}
            {SCORING.match.totalGoals}
          </p>
          <p>
            <strong className="text-slate-700">Skupiny:</strong>{" "}
            {SCORING.groupRanking.perPosition} b za pozici · +
            {SCORING.groupRanking.perfectBonus} bonus za přesné pořadí · král
            střelců {SCORING.groupScorer}
          </p>
          <p>
            <strong className="text-slate-700">Postupy</strong> (R32 · R16 ·
            ČF · SF · F): {SCORING.advancers.R32} · {SCORING.advancers.R16} ·{" "}
            {SCORING.advancers.QF} · {SCORING.advancers.SF} ·{" "}
            {SCORING.advancers.F} za tým
          </p>
          <p>
            <strong className="text-slate-700">Speciální:</strong> vítěz
            turnaje {SCORING.tournamentWinner} · král střelců turnaje{" "}
            {SCORING.tournamentTopScorer}
          </p>
        </div>
      </main>
    </div>
  );
}

function Row({
  row,
  rank,
}: {
  row: Awaited<ReturnType<typeof computeLeaderboard>>[number];
  rank: number;
}) {
  const displayName = row.name ?? row.email;
  return (
    <tr>
      <td className="px-3 py-3 text-center font-semibold tabular-nums text-slate-700">
        {rank}.
      </td>
      <td className="px-3 py-3">
        <div className="font-medium text-slate-900">{displayName}</div>
        {/* Breakdown subtitle — jen pro web */}
        <div className="mt-0.5 text-xs text-slate-500 print:hidden">
          {row.breakdown.matches}z · {row.breakdown.groupRanking}sk ·{" "}
          {row.breakdown.groupScorers}kr · {row.breakdown.advancers}p ·{" "}
          {row.breakdown.special}sp
        </div>
      </td>
      {/* Breakdown sloupce — jen pro tisk */}
      <td className="hidden px-3 py-3 text-right tabular-nums text-slate-700 print:table-cell">
        {row.breakdown.matches}
      </td>
      <td className="hidden px-3 py-3 text-right tabular-nums text-slate-700 print:table-cell">
        {row.breakdown.groupRanking}
      </td>
      <td className="hidden px-3 py-3 text-right tabular-nums text-slate-700 print:table-cell">
        {row.breakdown.groupScorers}
      </td>
      <td className="hidden px-3 py-3 text-right tabular-nums text-slate-700 print:table-cell">
        {row.breakdown.advancers}
      </td>
      <td className="hidden px-3 py-3 text-right tabular-nums text-slate-700 print:table-cell">
        {row.breakdown.special}
      </td>
      <td className="px-3 py-3 text-right text-lg font-bold tabular-nums text-slate-900">
        {row.total}
      </td>
    </tr>
  );
}
