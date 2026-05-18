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

  // --- Skupinová fáze: 12 sekcí „Skupina A..L" ---
  const groupSectionsMap = new Map<string, typeof matches>();
  for (const m of matches) {
    if (m.stage !== "GROUP") continue;
    if (!m.homeTeam || !m.awayTeam) continue;
    const key = m.group ?? "?";
    const list = groupSectionsMap.get(key) ?? [];
    list.push(m);
    groupSectionsMap.set(key, list);
  }
  const groupSections: SectionData[] = Array.from(groupSectionsMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([group, ms]) => ({
      label: `Skupina ${group}`,
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

  // --- Vyřazovací fáze: sekce per kolo (jen pokud admin přidal páry) ---
  const knockoutSectionsMap = new Map<string, typeof matches>();
  for (const m of matches) {
    if (m.stage === "GROUP") continue;
    if (!m.homeTeam || !m.awayTeam) continue;
    const list = knockoutSectionsMap.get(m.stage) ?? [];
    list.push(m);
    knockoutSectionsMap.set(m.stage, list);
  }
  const knockoutSections: SectionData[] = Array.from(
    knockoutSectionsMap.entries()
  )
    .sort(
      ([a], [b]) =>
        (KNOCKOUT_ORDER[a]?.idx ?? 99) - (KNOCKOUT_ORDER[b]?.idx ?? 99)
    )
    .map(([stage, ms]) => ({
      label: KNOCKOUT_ORDER[stage]?.label ?? stage,
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

  const allSections = [...groupSections, ...knockoutSections];

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
          {knockoutSections.length === 0 && (
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
