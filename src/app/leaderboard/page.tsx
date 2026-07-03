import Link from "next/link";

import { PrintButton } from "@/components/print-button";
import { SiteHeader } from "@/components/site-header";
import { formatCzk, tournament } from "@/config/tournament";
import { requireSession } from "@/lib/auth-guards";
import { cn } from "@/lib/utils";
import { PAGE_WIDTH } from "@/lib/layout";
import { SCORING, computeLeaderboard } from "@/lib/scoring";

// Vzhled medailových míst (1.–3.) — pozadí řádku, odznak pořadí, emoji
// a styl karty s výhrou. Klíč = pořadí.
const MEDALS: Record<
  number,
  { row: string; badge: string; emoji: string; card: string }
> = {
  1: {
    row: "bg-amber-50 print:bg-white",
    badge: "bg-amber-400 text-amber-950",
    emoji: "🥇",
    card: "border-amber-300 bg-amber-50 text-amber-900",
  },
  2: {
    row: "bg-slate-100 print:bg-white",
    badge: "bg-slate-300 text-slate-800",
    emoji: "🥈",
    card: "border-slate-300 bg-slate-100 text-slate-800",
  },
  3: {
    row: "bg-orange-50 print:bg-white",
    badge: "bg-orange-300 text-orange-950",
    emoji: "🥉",
    card: "border-orange-300 bg-orange-50 text-orange-900",
  },
};

const prizeByPlace = new Map<number, (typeof tournament.prizes)[number]>(
  tournament.prizes.map((p) => [p.place, p])
);

const printDateFormatter = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Prague",
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
      <SiteHeader active="leaderboard">
        <div className={`mx-auto flex w-full ${PAGE_WIDTH} items-center justify-end gap-3 px-4 py-2 sm:px-6`}>
          <Link
            href="/leaderboard/prehled"
            className="rounded-full px-3 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100"
          >
            Kompletní přehled
          </Link>
          <PrintButton />
        </div>
      </SiteHeader>

      <main className={`mx-auto w-full ${PAGE_WIDTH} flex-1 px-4 py-6 sm:px-6 sm:py-8 print:max-w-full print:px-0 print:py-0`}>
        <h1 className="mb-4 text-xl font-bold tracking-tight sm:text-2xl print:hidden">
          Pořadí tipérů
        </h1>
        {/* Tiskový header — zobrazí se jen při tisku */}
        <div className="mb-4 hidden print:block">
          <h1 className="text-2xl font-bold tracking-tight">
            {tournament.name} — Pořadí tipérů
          </h1>
          <p className="mt-1 text-xs text-slate-600">
            Vytištěno {printDateFormatter.format(printedAt)}
          </p>
        </div>

        {/* Výhry pro první tři místa — vždy dobře viditelné nahoře. */}
        <div className="mb-6 grid grid-cols-3 gap-2 sm:gap-3">
          {tournament.prizes.map((p) => {
            const m = MEDALS[p.place];
            return (
              <div
                key={p.place}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-xl border p-3 text-center print:border-slate-400",
                  m?.card ?? "border-slate-200 bg-white text-slate-800"
                )}
              >
                <span className="text-2xl leading-none">{m?.emoji}</span>
                <span className="text-[11px] font-semibold uppercase tracking-wide">
                  {p.label}
                </span>
                <span className="text-base font-bold tabular-nums sm:text-lg">
                  {formatCzk(p.amountCzk)}
                </span>
              </div>
            );
          })}
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
                  <th className="hidden px-3 py-2 text-right lg:table-cell print:table-cell">
                    Zápasy
                  </th>
                  <th className="hidden px-3 py-2 text-right lg:table-cell print:table-cell">
                    Skupiny
                  </th>
                  <th className="hidden px-3 py-2 text-right lg:table-cell print:table-cell">
                    Střelci
                  </th>
                  <th className="hidden px-3 py-2 text-right lg:table-cell print:table-cell">
                    Postupy
                  </th>
                  <th className="hidden px-3 py-2 text-right lg:table-cell print:table-cell">
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
            <strong className="text-slate-700">Zápas:</strong> přesné skóre{" "}
            {SCORING.match.exact} · vítěz/remíza + gólový rozdíl{" "}
            {SCORING.match.winnerAndDiff} · jen vítěz{" "}
            {SCORING.match.winnerOnly} · jen počet gólů celkem{" "}
            {SCORING.match.totalGoals}
          </p>
          <p>
            <strong className="text-slate-700">Skupiny:</strong>{" "}
            {SCORING.groupRanking.perPosition} b za pozici ·{" "}
            {4 * SCORING.groupRanking.perPosition +
              SCORING.groupRanking.perfectBonus}{" "}
            b za celé pořadí · král střelců {SCORING.groupScorer}
          </p>
          <p>
            <strong className="text-slate-700">Postupy</strong> (R32 · R16 ·
            ČF · SF · 3. místo · F): {SCORING.advancers.R32} ·{" "}
            {SCORING.advancers.R16} · {SCORING.advancers.QF} ·{" "}
            {SCORING.advancers.SF} · {SCORING.advancers.BRONZ} ·{" "}
            {SCORING.advancers.F} za tým
          </p>
          <p>
            <strong className="text-slate-700">Speciální:</strong> vítěz
            turnaje {SCORING.tournamentWinner} · král střelců turnaje{" "}
            {SCORING.tournamentTopScorer}
          </p>
          <p>
            <strong className="text-slate-700">Rovnost bodů:</strong>{" "}
            rozhoduje 1) správně tipnutý vítěz turnaje, pak 2) vyšší počet
            přesně tipnutých výsledků zápasů.
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
  const medal = MEDALS[rank];
  const prize = prizeByPlace.get(rank);
  return (
    <tr className={medal?.row}>
      <td className="px-3 py-3 text-center font-semibold tabular-nums text-slate-700">
        {medal ? (
          <span
            className={cn(
              "inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold",
              medal.badge
            )}
            aria-label={`${rank}. místo`}
          >
            {rank}
          </span>
        ) : (
          `${rank}.`
        )}
      </td>
      <td className="px-3 py-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-medium text-slate-900">{displayName}</span>
          {prize && (
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums print:border-slate-400",
                medal?.card ?? "border-slate-200 text-slate-700"
              )}
            >
              {medal?.emoji} {formatCzk(prize.amountCzk)}
            </span>
          )}
        </div>
        {/* Breakdown subtitle — jen pro web */}
        <div className="mt-0.5 text-xs text-slate-500 lg:hidden print:hidden">
          {row.breakdown.matches}z · {row.breakdown.groupRanking}sk ·{" "}
          {row.breakdown.groupScorers}kr · {row.breakdown.advancers}p ·{" "}
          {row.breakdown.special}sp
        </div>
      </td>
      {/* Breakdown sloupce — jen pro tisk */}
      <td className="hidden px-3 py-3 text-right tabular-nums text-slate-700 lg:table-cell print:table-cell">
        {row.breakdown.matches}
      </td>
      <td className="hidden px-3 py-3 text-right tabular-nums text-slate-700 lg:table-cell print:table-cell">
        {row.breakdown.groupRanking}
      </td>
      <td className="hidden px-3 py-3 text-right tabular-nums text-slate-700 lg:table-cell print:table-cell">
        {row.breakdown.groupScorers}
      </td>
      <td className="hidden px-3 py-3 text-right tabular-nums text-slate-700 lg:table-cell print:table-cell">
        {row.breakdown.advancers}
      </td>
      <td className="hidden px-3 py-3 text-right tabular-nums text-slate-700 lg:table-cell print:table-cell">
        {row.breakdown.special}
      </td>
      <td className="px-3 py-3 text-right text-lg font-bold tabular-nums text-slate-900">
        {row.total}
      </td>
    </tr>
  );
}
