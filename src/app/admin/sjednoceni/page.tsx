import Link from "next/link";

import {
  ScorerAliasesForm,
  type ScorerAliasesData,
  type ScorerSection,
  type ScorerTipVariant,
} from "@/components/scorer-aliases-form";
import { tournament } from "@/config/tournament";
import { requireAdmin } from "@/lib/auth-guards";
import { db } from "@/lib/db";
import { PAGE_WIDTH } from "@/lib/layout";
import { normalizeName } from "@/lib/scoring";

const GROUP_LETTERS = [
  "A", "B", "C", "D", "E", "F",
  "G", "H", "I", "J", "K", "L",
] as const;

function labelForType(type: string): string {
  if (type === "TOP_SCORER_TOURNAMENT") return "Král střelců turnaje";
  const m = type.match(/^TOP_SCORER_GROUP_([A-L])$/);
  if (m) return `Král střelců skupiny ${m[1]}`;
  return type;
}

function sortKey(type: string): string {
  // Turnaj nahoru, pak skupiny A–L
  if (type === "TOP_SCORER_TOURNAMENT") return "0";
  return `1_${type}`;
}

export default async function AdminScorerAliasesPage() {
  const session = await requireAdmin("/admin/sjednoceni");

  const allTypes = [
    "TOP_SCORER_TOURNAMENT",
    ...GROUP_LETTERS.map((g) => `TOP_SCORER_GROUP_${g}`),
  ];

  const [results, tips] = await Promise.all([
    db.tournamentResult.findMany({
      where: { type: { in: allTypes } },
      select: { type: true, value: true, acceptedAliases: true },
    }),
    db.specialTip.findMany({
      where: { type: { in: allTypes } },
      select: { type: true, value: true },
    }),
  ]);

  const tipsByType = new Map<string, string[]>();
  for (const t of tips) {
    const list = tipsByType.get(t.type) ?? [];
    list.push(t.value);
    tipsByType.set(t.type, list);
  }

  const sections: ScorerSection[] = results
    .filter((r) => r.value.trim() !== "")
    .map((r) => {
      const realN = normalizeName(r.value);
      const acceptedNormSet = new Set(
        r.acceptedAliases.map((a) => normalizeName(a))
      );

      // Skupiny tipů podle normalizované formy → reprezentativní pravopis
      const byNorm = new Map<
        string,
        { displays: Map<string, number>; total: number }
      >();
      for (const raw of tipsByType.get(r.type) ?? []) {
        const trimmed = raw.trim();
        if (!trimmed) continue;
        const n = normalizeName(trimmed);
        if (!n) continue;
        const entry = byNorm.get(n) ?? { displays: new Map(), total: 0 };
        entry.displays.set(trimmed, (entry.displays.get(trimmed) ?? 0) + 1);
        entry.total += 1;
        byNorm.set(n, entry);
      }

      const variants: ScorerTipVariant[] = Array.from(byNorm.entries()).map(
        ([normalized, info]) => {
          // Nejčastější pravopis vyhraje (při remíze: první podle abecedy)
          const sorted = Array.from(info.displays.entries()).sort((a, b) => {
            if (b[1] !== a[1]) return b[1] - a[1];
            return a[0].localeCompare(b[0], "cs-CZ");
          });
          const display = sorted[0]?.[0] ?? "";
          return {
            display,
            normalized,
            count: info.total,
            isAutoMatch: normalized === realN,
            isCurrentlyAccepted: acceptedNormSet.has(normalized),
          };
        }
      );

      // Manual variants (ne auto-match) první, pak auto; uvnitř podle count desc
      variants.sort((a, b) => {
        if (a.isAutoMatch !== b.isAutoMatch) return a.isAutoMatch ? 1 : -1;
        if (b.count !== a.count) return b.count - a.count;
        return a.display.localeCompare(b.display, "cs-CZ");
      });

      return {
        type: r.type,
        label: labelForType(r.type),
        realValue: r.value,
        variants,
      };
    })
    .sort((a, b) => sortKey(a.type).localeCompare(sortKey(b.type)));

  const data: ScorerAliasesData = { sections };

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
              Sjednocení králů střelců
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
          Tipy na krále střelců se píší volným textem. Po zadání skutečnosti
          systém automaticky uzná tipy, které se po normalizaci (diakritika,
          velikost písmen, mezery) shodují. Zde můžeš ručně označit další
          varianty pravopisu, které se mají počítat jako shoda.
        </div>
        <ScorerAliasesForm data={data} />
      </main>
    </div>
  );
}
