import Link from "next/link";
import {
  ArrowRight,
  GitFork,
  ListChecks,
  Mail,
  Medal,
  Network,
  Scale,
  Trophy,
} from "lucide-react";

import { requireAdmin } from "@/lib/auth-guards";
import { db } from "@/lib/db";
import { tournament } from "@/config/tournament";

export default async function AdminPage() {
  await requireAdmin("/admin");

  const [
    totalMatches,
    playedMatches,
    groupResultsCount,
    knockoutResultsCount,
    specialResultsCount,
    groupScorersCount,
    userCount,
    knockoutMatchesCount,
    scorerTypesWithResult,
  ] = await Promise.all([
    db.match.count({ where: { stage: "GROUP" } }),
    db.match.count({
      where: { stage: "GROUP", homeScore: { not: null }, awayScore: { not: null } },
    }),
    db.groupRankingResult.count(),
    db.knockoutAdvancersResult.count(),
    db.tournamentResult.count({
      where: { type: { in: ["TOURNAMENT_WINNER", "TOP_SCORER_TOURNAMENT"] } },
    }),
    db.tournamentResult.count({
      where: { type: { startsWith: "TOP_SCORER_GROUP_" } },
    }),
    db.user.count(),
    db.match.count({
      where: {
        stage: {
          in: [
            "ROUND_OF_32",
            "ROUND_OF_16",
            "QUARTER_FINAL",
            "SEMI_FINAL",
            "THIRD_PLACE",
            "FINAL",
          ],
        },
      },
    }),
    db.tournamentResult.count({
      where: { type: { startsWith: "TOP_SCORER_" } },
    }),
  ]);

  const remaining = totalMatches - playedMatches;
  const TOTAL_KNOCKOUT = 16 + 8 + 4 + 2 + 1 + 1; // R32 + R16 + QF + SF + Bronz + F = 32

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
              Admin
            </h1>
          </div>
          <p className="text-xs text-slate-500">Zadávání reálných výsledků</p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <div className="grid gap-4 sm:grid-cols-2">
          <AdminCard
            href="/admin/zapasy"
            icon={<ListChecks className="size-5 text-emerald-600" />}
            title="Výsledky zápasů"
            summary={
              <>
                {playedMatches} / {totalMatches} zápasů zadaných
                {remaining > 0 && (
                  <span className="ml-1 text-amber-700">
                    ({remaining} zbývá)
                  </span>
                )}
              </>
            }
          />

          <AdminCard
            href="/admin/skupiny"
            icon={<Medal className="size-5 text-sky-600" />}
            title="Pořadí skupin"
            summary={
              <>
                {groupResultsCount} / 12 pořadí ·{" "}
                {groupScorersCount} / 12 střelců skupin
              </>
            }
          />

          <AdminCard
            href="/admin/postupujici"
            icon={<Network className="size-5 text-indigo-600" />}
            title="Postupující kola"
            summary={<>{knockoutResultsCount} / 5 kol vyplněno</>}
          />

          <AdminCard
            href="/admin/specialni"
            icon={<Trophy className="size-5 text-amber-600" />}
            title="Speciální výsledky"
            summary={<>{specialResultsCount} / 2 (vítěz + král střelců)</>}
          />

          <AdminCard
            href="/admin/pavouk"
            icon={<GitFork className="size-5 text-violet-600" />}
            title="Vyřazovací pavouk"
            summary={
              <>
                {knockoutMatchesCount} / {TOTAL_KNOCKOUT} zápasů
                {knockoutMatchesCount === 0 && (
                  <span className="ml-1 text-slate-500">
                    (doplň po skupinách)
                  </span>
                )}
              </>
            }
          />

          <AdminCard
            href="/admin/sjednoceni"
            icon={<Scale className="size-5 text-teal-600" />}
            title="Sjednocení střelců"
            summary={
              <>
                {scorerTypesWithResult} / 13 zadáno
                {scorerTypesWithResult === 0 && (
                  <span className="ml-1 text-slate-500">
                    (po skončení skupin)
                  </span>
                )}
              </>
            }
          />

          <AdminCard
            href="/admin/pozvanky"
            icon={<Mail className="size-5 text-rose-600" />}
            title="Pozvánky kamarádům"
            summary={
              <>
                {userCount}{" "}
                {userCount === 1
                  ? "tipér zaregistrován"
                  : userCount < 5
                    ? "tipéři zaregistrováni"
                    : "tipérů zaregistrováno"}
              </>
            }
          />
        </div>
      </main>
    </div>
  );
}

function AdminCard({
  href,
  icon,
  title,
  summary,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  summary: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-slate-400"
    >
      <div className="flex items-center justify-between">
        {icon}
        <ArrowRight className="size-4 text-slate-400 transition-transform group-hover:translate-x-0.5" />
      </div>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="text-sm text-slate-600">{summary}</p>
    </Link>
  );
}
