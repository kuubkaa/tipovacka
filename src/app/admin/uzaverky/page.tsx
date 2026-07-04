import Link from "next/link";

import {
  DeadlinesForm,
  type DeadlineSection,
  type DeadlineUnit,
} from "@/components/deadlines-form";
import { tournament } from "@/config/tournament";
import { requireAdmin } from "@/lib/auth-guards";
import { db } from "@/lib/db";
import {
  loadDeadlineContext,
  matchScope,
  SCOPE_RANKINGS,
  SCOPE_SPECIALS,
  stageScope,
} from "@/lib/deadlines";
import { PAGE_WIDTH } from "@/lib/layout";
import { utcToPragueLocal } from "@/lib/prague-time";

const KNOCKOUT_ORDER: Record<string, { idx: number; label: string }> = {
  ROUND_OF_32: { idx: 1, label: "Šestnáctifinále" },
  ROUND_OF_16: { idx: 2, label: "Osmifinále" },
  QUARTER_FINAL: { idx: 3, label: "Čtvrtfinále" },
  SEMI_FINAL: { idx: 4, label: "Semifinále" },
  THIRD_PLACE: { idx: 5, label: "O 3. místo" },
  FINAL: { idx: 6, label: "Finále" },
};

const fullFormatter = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Prague",
});

const shortFormatter = new Intl.DateTimeFormat("cs-CZ", {
  weekday: "short",
  day: "numeric",
  month: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Prague",
});

export default async function AdminUzaverkyPage() {
  await requireAdmin("/admin/uzaverky");

  const [matches, ctx] = await Promise.all([
    db.match.findMany({
      include: {
        homeTeam: { select: { name: true, flagEmoji: true } },
        awayTeam: { select: { name: true, flagEmoji: true } },
      },
      orderBy: [{ stage: "asc" }, { group: "asc" }, { dateUtc: "asc" }],
    }),
    loadDeadlineContext(),
  ]);

  /** Postaví jednu jednotku pro formulář. */
  const unit = (
    scope: string,
    label: string,
    autoDate: Date,
    effectiveDate: Date,
    sub?: string
  ): DeadlineUnit => {
    const override = ctx.overrides.get(scope) ?? null;
    return {
      scope,
      label,
      sub,
      autoLocal: utcToPragueLocal(autoDate),
      autoText: fullFormatter.format(autoDate),
      overrideLocal: override ? utcToPragueLocal(override) : null,
      effectiveText: fullFormatter.format(effectiveDate),
      hasOverride: override !== null,
    };
  };

  const matchLabel = (m: (typeof matches)[number]): string => {
    if (m.homeTeam && m.awayTeam) {
      return `${m.homeTeam.flagEmoji ?? ""} ${m.homeTeam.name} – ${m.awayTeam.name} ${m.awayTeam.flagEmoji ?? ""}`.trim();
    }
    return m.matchKey;
  };

  // --- Skupinová fáze ---
  const groupMatches = matches.filter((m) => m.stage === "GROUP");
  const groupMatchesUnit = unit(
    stageScope("GROUP"),
    "Skupinové zápasy",
    ctx.stageAutoDeadline("GROUP"),
    ctx.stageDeadline("GROUP"),
    `${groupMatches.length} zápasů`
  );
  groupMatchesUnit.matches = groupMatches.map((m) =>
    unit(
      matchScope(m.id),
      `${m.group ? `Sk. ${m.group} · ` : ""}${matchLabel(m)}`,
      ctx.stageDeadline("GROUP"),
      ctx.matchDeadline(m),
      shortFormatter.format(m.dateUtc)
    )
  );
  const groupSection: DeadlineSection = {
    title: "Skupinová fáze",
    units: [
      groupMatchesUnit,
      unit(
        SCOPE_RANKINGS,
        "Pořadí skupin",
        tournament.deadline,
        ctx.rankingsDeadline()
      ),
      unit(
        SCOPE_SPECIALS,
        "Speciální tipy",
        tournament.deadline,
        ctx.specialsDeadline(),
        "Postupující, vítěz turnaje, král střelců"
      ),
    ],
  };

  // --- Vyřazovací kola (jen ta, co mají zápasy) ---
  const koStages = Array.from(
    new Set(matches.filter((m) => m.stage !== "GROUP").map((m) => m.stage))
  ).sort((a, b) => (KNOCKOUT_ORDER[a]?.idx ?? 99) - (KNOCKOUT_ORDER[b]?.idx ?? 99));

  const koSections: DeadlineSection[] = koStages.map((stage) => {
    const stageMatches = matches.filter((m) => m.stage === stage);
    const label = KNOCKOUT_ORDER[stage]?.label ?? stage;
    const roundUnit = unit(
      stageScope(stage),
      `${label} — celé kolo`,
      ctx.stageAutoDeadline(stage),
      ctx.stageDeadline(stage),
      `${stageMatches.length} zápasů`
    );
    roundUnit.matches = stageMatches.map((m) =>
      unit(
        matchScope(m.id),
        matchLabel(m),
        ctx.stageDeadline(stage),
        ctx.matchDeadline(m),
        shortFormatter.format(m.dateUtc)
      )
    );
    return { title: label, units: [roundUnit] };
  });

  const sections = [groupSection, ...koSections];

  return (
    <div className="flex flex-1 flex-col bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className={`mx-auto flex w-full ${PAGE_WIDTH} items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4`}>
          <div className="min-w-0">
            <Link
              href="/admin"
              className="text-xs uppercase tracking-wider text-slate-500 hover:text-slate-700"
            >
              ← Admin
            </Link>
            <h1 className="text-lg font-bold tracking-tight sm:text-xl">
              Uzávěrky tipů
            </h1>
          </div>
          <p className="text-xs text-slate-500">{tournament.shortName}</p>
        </div>
      </header>

      <main className={`mx-auto w-full ${PAGE_WIDTH} flex-1 px-4 py-6 sm:px-6 sm:py-8`}>
        <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
          <p>
            Každá jednotka má <strong>automatickou</strong> uzávěrku (výkop
            prvního zápasu fáze). Tady ji můžeš <strong>ručně přebít</strong>{" "}
            vlastním datem a časem — pro celé kolo, jednotlivý zápas, pořadí
            skupin nebo speciály. Pole je předvyplněné aktuálně platnou
            hodnotou, stačí ji upravit a uložit.
          </p>
          <p className="mt-2 text-slate-500">
            Ruční uzávěrka zápasu má přednost před uzávěrkou kola. Uzavření
            skupinové fáze zároveň <strong>zveřejní tipy všech</strong> (jako
            automatický start turnaje).
          </p>
        </div>

        <DeadlinesForm sections={sections} />
      </main>
    </div>
  );
}
