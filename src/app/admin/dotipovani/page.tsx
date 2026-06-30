import Link from "next/link";

import { GrantForm, type GrantStage, type GrantUser, type ExistingGrant } from "@/components/grant-form";
import { getAppOrigin } from "@/lib/app-url";
import { tournament } from "@/config/tournament";
import { requireAdmin } from "@/lib/auth-guards";
import { db } from "@/lib/db";
import { utcToPragueLocal } from "@/lib/prague-time";

const KNOCKOUT_ORDER: Record<string, { idx: number; label: string }> = {
  ROUND_OF_32: { idx: 1, label: "Šestnáctifinále" },
  ROUND_OF_16: { idx: 2, label: "Osmifinále" },
  QUARTER_FINAL: { idx: 3, label: "Čtvrtfinále" },
  SEMI_FINAL: { idx: 4, label: "Semifinále" },
  THIRD_PLACE: { idx: 5, label: "O 3. místo" },
  FINAL: { idx: 6, label: "Finále" },
};

const matchDateFormatter = new Intl.DateTimeFormat("cs-CZ", {
  weekday: "short",
  day: "numeric",
  month: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Prague",
});

const expiryFormatter = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Prague",
});

export default async function AdminDotipovaniPage() {
  await requireAdmin("/admin/dotipovani");

  const [users, matches, grants] = await Promise.all([
    db.user.findMany({
      where: { name: { not: null } },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
    db.match.findMany({
      where: {
        stage: { not: "GROUP" },
        homeTeamId: { not: null },
        awayTeamId: { not: null },
      },
      include: {
        homeTeam: { select: { name: true, flagEmoji: true } },
        awayTeam: { select: { name: true, flagEmoji: true } },
      },
      orderBy: [{ stage: "asc" }, { dateUtc: "asc" }],
    }),
    db.tipEditGrant.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        token: true,
        matchIds: true,
        expiresAt: true,
        usedAt: true,
        user: { select: { name: true, email: true } },
      },
    }),
  ]);

  const userList: GrantUser[] = users.map((u) => ({
    id: u.id,
    label: u.name ?? u.email,
  }));

  // Seskup vyřazovací zápasy po kolech.
  const byStage = new Map<string, typeof matches>();
  for (const m of matches) {
    const list = byStage.get(m.stage) ?? [];
    list.push(m);
    byStage.set(m.stage, list);
  }
  const stages: GrantStage[] = Array.from(byStage.entries())
    .sort(
      ([a], [b]) =>
        (KNOCKOUT_ORDER[a]?.idx ?? 99) - (KNOCKOUT_ORDER[b]?.idx ?? 99)
    )
    .map(([stage, ms]) => ({
      label: KNOCKOUT_ORDER[stage]?.label ?? stage,
      matches: ms.map((m) => ({
        id: m.id,
        label: `${m.homeTeam!.flagEmoji ?? ""} ${m.homeTeam!.name} – ${m.awayTeam!.name} ${m.awayTeam!.flagEmoji ?? ""}`.trim(),
        dateLabel: matchDateFormatter.format(m.dateUtc),
      })),
    }));

  const now = new Date();
  const origin = await getAppOrigin();
  const existingGrants: ExistingGrant[] = grants.map((g) => ({
    id: g.id,
    url: `${origin}/dotipovani/${g.token}`,
    userLabel: g.user.name ?? g.user.email,
    matchCount: g.matchIds.length,
    expiresLabel: expiryFormatter.format(g.expiresAt),
    expired: g.expiresAt.getTime() <= now.getTime(),
    usedLabel: g.usedAt ? expiryFormatter.format(g.usedAt) : null,
  }));

  // Výchozí expirace = za 7 dní (pražský nástěnný čas pro datetime-local).
  const defaultExpiryDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const defaultExpiry = utcToPragueLocal(defaultExpiryDate);

  return (
    <div className="flex flex-1 flex-col bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <div className="min-w-0">
            <Link
              href="/admin"
              className="text-xs uppercase tracking-wider text-slate-500 hover:text-slate-700"
            >
              ← Admin
            </Link>
            <h1 className="text-lg font-bold tracking-tight sm:text-xl">
              Dotipování přes odkaz
            </h1>
          </div>
          <p className="text-xs text-slate-500">{tournament.shortName}</p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
          <p>
            Vyber kamaráda, zaškrtni zápasy, které smí dotipovat i po uzávěrce,
            a nastav platnost odkazu. Vygeneruje se speciální odkaz — pošli mu
            ho (např. přes WhatsApp). Kdokoli s odkazem může tipy daného
            kamaráda vyplnit, proto odkaz nech platit jen nezbytně dlouho a po
            doplnění ho můžeš zrušit.
          </p>
        </div>

        {stages.length === 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Zatím nejsou žádné vyřazovací zápasy s vyplněnými oběma týmy.
            Nejdřív doplň pavouka v sekci{" "}
            <Link href="/admin/pavouk" className="font-medium underline">
              Vyřazovací pavouk
            </Link>
            .
          </div>
        ) : (
          <GrantForm
            users={userList}
            stages={stages}
            existingGrants={existingGrants}
            defaultExpiry={defaultExpiry}
          />
        )}
      </main>
    </div>
  );
}
