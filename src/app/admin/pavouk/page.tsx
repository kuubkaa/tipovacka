import Link from "next/link";

import {
  KnockoutFixturesForm,
  type ExistingFixture,
  type KnockoutFixturesData,
} from "@/components/knockout-fixtures-form";
import { tournament } from "@/config/tournament";
import { requireAdmin } from "@/lib/auth-guards";
import { db } from "@/lib/db";

/**
 * Z UTC Date vytvoří string pro <input type="datetime-local"> v lokálním
 * (browser) timezone uživatele. Server ale render proběhne v UTC; tady
 * to vrátíme jako lokální čas Praha (přepočítáme manuálně), protože ten
 * je správný pro admina.
 */
function toLocalDatetimeInput(d: Date): string {
  const pragueOffsetMs = 2 * 60 * 60 * 1000; // léto = CEST = UTC+2; je léto v červnu-červenci
  const local = new Date(d.getTime() + pragueOffsetMs);
  return local.toISOString().slice(0, 16);
}

export default async function AdminPavoukPage() {
  const session = await requireAdmin("/admin/pavouk");

  const [teams, knockoutMatches] = await Promise.all([
    db.team.findMany({
      where: { group: { not: null } },
      select: { code: true, name: true, flagEmoji: true, group: true },
      orderBy: { name: "asc" },
    }),
    db.match.findMany({
      where: {
        stage: {
          in: [
            "ROUND_OF_32",
            "ROUND_OF_16",
            "QUARTER_FINAL",
            "SEMI_FINAL",
            "FINAL",
          ],
        },
      },
      include: {
        homeTeam: { select: { code: true } },
        awayTeam: { select: { code: true } },
      },
    }),
  ]);

  const existing: ExistingFixture[] = knockoutMatches
    .filter((m) => m.homeTeam && m.awayTeam)
    .map((m) => ({
      matchKey: m.matchKey,
      homeCode: m.homeTeam!.code,
      awayCode: m.awayTeam!.code,
      dateLocal: toLocalDatetimeInput(m.dateUtc),
    }));

  const data: KnockoutFixturesData = {
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
              Vyřazovací pavouk
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
            Po skončení skupinové fáze sem postupně doplňuj dvojice. Stačí
            vybrat oba týmy a zadat výkop. Po uložení uvidí tipéři ve{" "}
            <Link
              href="/formular"
              className="font-medium text-slate-900 underline-offset-4 hover:underline"
            >
              formuláři
            </Link>{" "}
            novou sekci a budou tipovat skóre — každý zápas má vlastní deadline
            (= výkop).
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Datum a čas zadávej v lokálním (pražském) čase. Sekce „O 3. místo"
            je jeden zápas mezi poraženými ze semifinále, hraje se obvykle den
            před finále.
          </p>
        </div>
        <KnockoutFixturesForm data={data} />
      </main>
    </div>
  );
}
