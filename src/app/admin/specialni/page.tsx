import Link from "next/link";

import {
  SpecialResultsForm,
  type SpecialResultsData,
} from "@/components/special-results-form";
import { tournament } from "@/config/tournament";
import { requireAdmin } from "@/lib/auth-guards";
import { db } from "@/lib/db";

export default async function AdminSpecialPage() {
  const session = await requireAdmin("/admin/specialni");

  const [teams, results] = await Promise.all([
    db.team.findMany({
      where: { group: { not: null } },
      select: { code: true, name: true, flagEmoji: true, group: true },
      orderBy: { name: "asc" },
    }),
    db.tournamentResult.findMany({
      where: { type: { in: ["TOURNAMENT_WINNER", "TOP_SCORER_TOURNAMENT"] } },
      select: { type: true, value: true },
    }),
  ]);

  const data: SpecialResultsData = {
    teams: teams.map((t) => ({
      code: t.code,
      name: t.name,
      flagEmoji: t.flagEmoji,
      group: t.group ?? "?",
    })),
    existing: Object.fromEntries(results.map((r) => [r.type, r.value])),
  };

  return (
    <div className="flex flex-1 flex-col bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <div className="min-w-0">
            <Link
              href="/admin"
              className="text-xs uppercase tracking-wider text-slate-500 hover:text-slate-700"
            >
              ← Admin
            </Link>
            <h1 className="text-lg font-bold tracking-tight sm:text-xl">
              Speciální výsledky
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

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
          Po skončení turnaje zadej vítěze a krále střelců celého turnaje.
          Krále střelců jednotlivých skupin zadáváš v sekci{" "}
          <Link
            href="/admin/skupiny"
            className="font-medium text-slate-900 underline-offset-4 hover:underline"
          >
            Pořadí skupin
          </Link>
          .
        </div>
        <SpecialResultsForm data={data} />
      </main>
    </div>
  );
}
