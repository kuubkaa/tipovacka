import Link from "next/link";

import { MatchResultsForm } from "@/components/match-results-form";
import { tournament } from "@/config/tournament";
import { requireAdmin } from "@/lib/auth-guards";
import { db } from "@/lib/db";

export default async function AdminMatchResultsPage() {
  const session = await requireAdmin("/admin/zapasy");

  const matches = await db.match.findMany({
    where: { stage: "GROUP" },
    include: {
      homeTeam: { select: { code: true, name: true, flagEmoji: true } },
      awayTeam: { select: { code: true, name: true, flagEmoji: true } },
    },
    orderBy: [{ group: "asc" }, { dateUtc: "asc" }],
  });

  const groups = new Map<string, typeof matches>();
  for (const m of matches) {
    const key = m.group ?? "?";
    const list = groups.get(key) ?? [];
    list.push(m);
    groups.set(key, list);
  }

  const groupsSerialized = Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([group, ms]) => ({
      group,
      matches: ms.map((m) => ({
        id: m.id,
        matchKey: m.matchKey,
        dateIso: m.dateUtc.toISOString(),
        home: m.homeTeam!,
        away: m.awayTeam!,
        homeScore: m.homeScore,
        awayScore: m.awayScore,
      })),
    }));

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
              Výsledky zápasů
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
          Zadej skutečné skóre po skončení zápasu. Vyplň obě políčka, jinak se
          nic neuloží. Smazat zadaný výsledek lze vyprázdněním obou polí.
        </div>
        <MatchResultsForm groups={groupsSerialized} />
      </main>
    </div>
  );
}
