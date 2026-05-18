import Link from "next/link";
import { ArrowRight, ListChecks } from "lucide-react";

import { requireAdmin } from "@/lib/auth-guards";
import { db } from "@/lib/db";
import { tournament } from "@/config/tournament";

export default async function AdminPage() {
  await requireAdmin("/admin");

  // Stats pro admin landing
  const [totalMatches, playedMatches] = await Promise.all([
    db.match.count({ where: { stage: "GROUP" } }),
    db.match.count({
      where: { stage: "GROUP", homeScore: { not: null }, awayScore: { not: null } },
    }),
  ]);
  const remaining = totalMatches - playedMatches;

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
          <Link
            href="/admin/zapasy"
            className="group flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-slate-400"
          >
            <div className="flex items-center justify-between">
              <ListChecks className="size-5 text-emerald-600" />
              <ArrowRight className="size-4 text-slate-400 transition-transform group-hover:translate-x-0.5" />
            </div>
            <h2 className="text-base font-semibold">Výsledky zápasů</h2>
            <p className="text-sm text-slate-600">
              {playedMatches} / {totalMatches} zápasů zadaných
              {remaining > 0 && (
                <span className="ml-1 text-amber-700">
                  ({remaining} zbývá)
                </span>
              )}
            </p>
          </Link>

          <div className="flex flex-col gap-2 rounded-xl border border-dashed border-slate-300 bg-white p-5 opacity-60">
            <h2 className="text-base font-semibold">Pořadí skupin</h2>
            <p className="text-sm text-slate-500">
              Doplníme v další iteraci — odemyká se po skončení skupin.
            </p>
          </div>

          <div className="flex flex-col gap-2 rounded-xl border border-dashed border-slate-300 bg-white p-5 opacity-60">
            <h2 className="text-base font-semibold">Postupující kola</h2>
            <p className="text-sm text-slate-500">
              R32 → R16 → ČF → SF → F. V další iteraci.
            </p>
          </div>

          <div className="flex flex-col gap-2 rounded-xl border border-dashed border-slate-300 bg-white p-5 opacity-60">
            <h2 className="text-base font-semibold">Speciální tipy</h2>
            <p className="text-sm text-slate-500">
              Vítěz turnaje, králové střelců. V další iteraci.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
