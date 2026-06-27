import Link from "next/link";

import {
  MatchResultsForm,
  type SectionData,
} from "@/components/match-results-form";
import { tournament } from "@/config/tournament";
import { requireAdmin } from "@/lib/auth-guards";
import { db } from "@/lib/db";

const KNOCKOUT_ORDER: Record<string, { idx: number; label: string }> = {
  ROUND_OF_32: { idx: 1, label: "Šestnáctifinále" },
  ROUND_OF_16: { idx: 2, label: "Osmifinále" },
  QUARTER_FINAL: { idx: 3, label: "Čtvrtfinále" },
  SEMI_FINAL: { idx: 4, label: "Semifinále" },
  THIRD_PLACE: { idx: 5, label: "O 3. místo" },
  FINAL: { idx: 6, label: "Finále" },
};

export default async function AdminMatchResultsPage() {
  const session = await requireAdmin("/admin/zapasy");

  const matches = await db.match.findMany({
    include: {
      homeTeam: { select: { code: true, name: true, flagEmoji: true } },
      awayTeam: { select: { code: true, name: true, flagEmoji: true } },
    },
    orderBy: [{ stage: "asc" }, { group: "asc" }, { dateUtc: "asc" }],
  });

  // Kontext zápasu pro řádek seznamu ("Skupina A" / "Osmifinále").
  const matchContext = (m: (typeof matches)[number]) =>
    m.stage === "GROUP"
      ? `Skupina ${m.group ?? "?"}`
      : KNOCKOUT_ORDER[m.stage]?.label ?? m.stage;

  // Název a pořadí fáze pro seskupení sekcí (skupiny → finále).
  const stageRank = (m: (typeof matches)[number]) =>
    m.stage === "GROUP" ? 0 : KNOCKOUT_ORDER[m.stage]?.idx ?? 99;
  const stageLabel = (m: (typeof matches)[number]) =>
    m.stage === "GROUP"
      ? "Skupinová fáze"
      : KNOCKOUT_ORDER[m.stage]?.label ?? m.stage;

  // Hratelné zápasy (mají oba týmy) seřazené podle výkopu.
  const playable = matches
    .filter((m) => m.homeTeam && m.awayTeam)
    .sort((a, b) => a.dateUtc.getTime() - b.dateUtc.getTime());

  const toData = (m: (typeof matches)[number]) => ({
    id: m.id,
    matchKey: m.matchKey,
    dateIso: m.dateUtc.toISOString(),
    context: matchContext(m),
    home: m.homeTeam!,
    away: m.awayTeam!,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
  });

  const isDone = (m: (typeof matches)[number]) =>
    m.homeScore !== null && m.awayScore !== null;

  // Seskupí zápasy podle fáze (skupiny → finále) do sekcí. `playable` je už
  // seřazené podle výkopu, takže uvnitř fáze zůstane chronologie.
  const bucketByStage = (
    list: (typeof matches)[number][],
    prefix: string
  ): SectionData[] => {
    const byRank = new Map<
      number,
      { label: string; matches: (typeof matches)[number][] }
    >();
    for (const m of list) {
      const rank = stageRank(m);
      if (!byRank.has(rank)) {
        byRank.set(rank, { label: stageLabel(m), matches: [] });
      }
      byRank.get(rank)!.matches.push(m);
    }
    return [...byRank.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, v]) => ({
        label: `${prefix}: ${v.label} (${v.matches.length})`,
        matches: v.matches.map(toData),
      }));
  };

  // Nezadané fáze nahoře (rozdělené po kolech), zadané pod nimi.
  const pendingMatches = playable.filter((m) => !isDone(m));
  const doneMatches = playable.filter(isDone);

  const hasKnockout = playable.some((m) => m.stage !== "GROUP");

  const allSections: SectionData[] = [
    ...bucketByStage(pendingMatches, "Zbývá zadat"),
    ...bucketByStage(doneMatches, "Zadané"),
  ];

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
          <p>
            Zadej skutečné skóre po skončení zápasu. Vyplň obě políčka, jinak
            se nic neuloží. Smazat zadaný výsledek lze vyprázdněním obou polí.
          </p>
          {!hasKnockout && (
            <p className="mt-2 text-xs text-slate-500">
              Vyřazovací fáze se zobrazí, až přidáš dvojice v{" "}
              <Link
                href="/admin/pavouk"
                className="font-medium text-slate-900 underline-offset-4 hover:underline"
              >
                Pavouku
              </Link>
              .
            </p>
          )}
        </div>
        <MatchResultsForm sections={allSections} />
      </main>
    </div>
  );
}
