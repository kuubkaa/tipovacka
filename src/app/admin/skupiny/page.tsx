import Link from "next/link";

import {
  GroupResultsForm,
  type GroupResultData,
} from "@/components/group-results-form";
import { tournament } from "@/config/tournament";
import { requireAdmin } from "@/lib/auth-guards";
import { db } from "@/lib/db";
import { PAGE_WIDTH } from "@/lib/layout";

export default async function AdminGroupsPage() {
  const session = await requireAdmin("/admin/skupiny");

  const [teams, results, scorerResults] = await Promise.all([
    db.team.findMany({
      where: { group: { not: null } },
      select: { code: true, name: true, flagEmoji: true, group: true },
      orderBy: { name: "asc" },
    }),
    db.groupRankingResult.findMany({
      select: { group: true, teamCodes: true },
    }),
    db.tournamentResult.findMany({
      where: { type: { startsWith: "TOP_SCORER_GROUP_" } },
      select: { type: true, value: true },
    }),
  ]);

  const teamsByGroup = new Map<string, typeof teams>();
  for (const t of teams) {
    if (!t.group) continue;
    const list = teamsByGroup.get(t.group) ?? [];
    list.push(t);
    teamsByGroup.set(t.group, list);
  }

  const rankingByGroup = new Map(results.map((r) => [r.group, r.teamCodes]));
  const scorerByGroup = new Map<string, string>();
  for (const sr of scorerResults) {
    const m = sr.type.match(/^TOP_SCORER_GROUP_([A-L])$/);
    if (m) scorerByGroup.set(m[1], sr.value);
  }

  const groups: GroupResultData[] = Array.from(teamsByGroup.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([group, ts]) => ({
      group,
      teams: ts.map((t) => ({
        code: t.code,
        name: t.name,
        flagEmoji: t.flagEmoji,
      })),
      existingRanking: rankingByGroup.get(group as never) ?? null,
      existingScorer: scorerByGroup.get(group) ?? null,
    }));

  return (
    <div className="flex flex-1 flex-col bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className={`mx-auto flex w-full ${PAGE_WIDTH} items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4`}>
          <div className="min-w-0">
            <Link
              href="/admin"
              className="text-xs uppercase tracking-wider text-slate-500 hover:text-slate-700"
            >
              ← Admin
            </Link>
            <h1 className="text-lg font-bold tracking-tight sm:text-xl">
              Pořadí skupin
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

      <main className={`mx-auto w-full ${PAGE_WIDTH} flex-1 px-4 py-6 sm:px-6 sm:py-8`}>
        <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
          Zadej skutečné konečné pořadí (1.–4. místo) a krále střelců pro
          každou skupinu. Vyprázdněním všech 4 pozic se výsledek skupiny
          smaže; vyprázdněním pole střelce se smaže střelec.
        </div>
        <GroupResultsForm groups={groups} />
      </main>
    </div>
  );
}
