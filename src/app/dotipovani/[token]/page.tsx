import Link from "next/link";

import {
  GrantTipsForm,
  type GrantSectionData,
} from "@/components/grant-tips-form";
import { tournament } from "@/config/tournament";
import { db } from "@/lib/db";

const KNOCKOUT_ORDER: Record<string, { idx: number; label: string }> = {
  ROUND_OF_32: { idx: 1, label: "Šestnáctifinále" },
  ROUND_OF_16: { idx: 2, label: "Osmifinále" },
  QUARTER_FINAL: { idx: 3, label: "Čtvrtfinále" },
  SEMI_FINAL: { idx: 4, label: "Semifinále" },
  THIRD_PLACE: { idx: 5, label: "O 3. místo" },
  FINAL: { idx: 6, label: "Finále" },
};

const expiryFormatter = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Prague",
});

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <Link
            href="/"
            className="text-xs uppercase tracking-wider text-slate-500 hover:text-slate-700"
          >
            {tournament.shortName}
          </Link>
          <p className="text-xs text-slate-500">Dotipování</p>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}

function InvalidMessage({ children }: { children: React.ReactNode }) {
  return (
    <Shell>
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
        {children}
      </div>
    </Shell>
  );
}

export default async function DotipovaniPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const grant = await db.tipEditGrant.findUnique({
    where: { token },
    select: {
      userId: true,
      matchIds: true,
      expiresAt: true,
      user: { select: { name: true } },
    },
  });

  if (!grant) {
    return (
      <InvalidMessage>
        Tento odkaz neplatí. Možná byl zrušen — ozvi se prosím adminovi.
      </InvalidMessage>
    );
  }
  const now = new Date();
  if (grant.expiresAt.getTime() <= now.getTime()) {
    return (
      <InvalidMessage>
        Platnost tohoto odkazu vypršela ({expiryFormatter.format(grant.expiresAt)}
        ). Pokud potřebuješ ještě dotipovat, ozvi se adminovi o nový odkaz.
      </InvalidMessage>
    );
  }

  const matches = await db.match.findMany({
    where: { id: { in: grant.matchIds } },
    include: {
      homeTeam: { select: { code: true, name: true, flagEmoji: true } },
      awayTeam: { select: { code: true, name: true, flagEmoji: true } },
    },
  });

  const tips = await db.tip.findMany({
    where: { userId: grant.userId, matchId: { in: grant.matchIds } },
    select: { matchId: true, homeScore: true, awayScore: true },
  });
  const tipByMatch = new Map(tips.map((t) => [t.matchId, t]));

  // Seskup povolené zápasy po kolech.
  const byStage = new Map<string, typeof matches>();
  for (const m of matches) {
    if (!m.homeTeam || !m.awayTeam) continue;
    const list = byStage.get(m.stage) ?? [];
    list.push(m);
    byStage.set(m.stage, list);
  }

  const sections: GrantSectionData[] = Array.from(byStage.entries())
    .sort(
      ([a], [b]) =>
        (KNOCKOUT_ORDER[a]?.idx ?? 99) - (KNOCKOUT_ORDER[b]?.idx ?? 99)
    )
    .map(([stage, ms]) => ({
      label: KNOCKOUT_ORDER[stage]?.label ?? stage,
      matches: ms
        .slice()
        .sort((a, b) => a.dateUtc.getTime() - b.dateUtc.getTime())
        .map((m) => ({
          id: m.id,
          dateIso: m.dateUtc.toISOString(),
          home: m.homeTeam!,
          away: m.awayTeam!,
          existingTip: tipByMatch.get(m.id) ?? null,
        })),
    }));

  if (sections.length === 0) {
    return (
      <InvalidMessage>
        Pro tento odkaz zatím nejsou připravené žádné zápasy. Ozvi se prosím
        adminovi.
      </InvalidMessage>
    );
  }

  return (
    <Shell>
      <h1 className="mb-4 text-xl font-bold tracking-tight sm:text-2xl">
        Doplnění tipů
      </h1>
      <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p>
          Tipy se ukládají za{" "}
          <strong>{grant.user.name ?? "tebe"}</strong>. Vyplň skóre u zápasů
          níže a klikni na <strong>Uložit tipy</strong>. Odkaz platí do{" "}
          <strong>{expiryFormatter.format(grant.expiresAt)}</strong> — během té
          doby se sem můžeš vrátit a tipy upravit.
        </p>
      </div>
      <GrantTipsForm token={token} sections={sections} />
    </Shell>
  );
}
