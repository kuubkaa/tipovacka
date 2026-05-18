import Link from "next/link";

import {
  KnockoutResultsForm,
  type KnockoutResultsData,
} from "@/components/knockout-results-form";
import { tournament } from "@/config/tournament";
import { requireAdmin } from "@/lib/auth-guards";
import { db } from "@/lib/db";

const STAGE_TO_KEY: Record<string, string> = {
  ROUND_OF_32: "R32",
  ROUND_OF_16: "R16",
  QUARTER_FINAL: "QF",
  SEMI_FINAL: "SF",
  FINAL: "F",
};

export default async function AdminAdvancersPage() {
  const session = await requireAdmin("/admin/postupujici");

  const [teams, results] = await Promise.all([
    db.team.findMany({
      where: { group: { not: null } },
      select: { code: true, name: true, flagEmoji: true, group: true },
      orderBy: { name: "asc" },
    }),
    db.knockoutAdvancersResult.findMany({
      select: { stage: true, teamCodes: true },
    }),
  ]);

  const existing: Record<string, string[]> = {};
  for (const r of results) {
    const key = STAGE_TO_KEY[r.stage];
    if (key) existing[key] = r.teamCodes;
  }

  const data: KnockoutResultsData = {
    teams: teams.map((t) => ({
      code: t.code,
      name: t.name,
      flagEmoji: t.flagEmoji,
      group: t.group ?? "?",
    })),
    existing,
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
              Postupující do vyřazovací fáze
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
          Po každém kole označ týmy, které postoupily dál. Stačí klikat na
          chipy — počítadlo v headeru ukazuje aktuální počet vs cílový.
          Smazat zaškrtnutí lze opětovným kliknutím; smazání všech v daném
          kole odstraní výsledek úplně.
        </div>
        <KnockoutResultsForm data={data} />
      </main>
    </div>
  );
}
