import Link from "next/link";

import { tournament } from "@/config/tournament";
import { requireAdmin } from "@/lib/auth-guards";
import { db } from "@/lib/db";
import { KNOCKOUT_ADVANCERS_ROUNDS } from "@/lib/knockout-rounds";
import { cn } from "@/lib/utils";

import { PaidToggle } from "./paid-toggle";

const GROUP_LETTERS = [
  "A", "B", "C", "D", "E", "F",
  "G", "H", "I", "J", "K", "L",
] as const;

// Kola vyřazovací fáze pro rozpad sloupce „Zápasy". V tabulce se zobrazí
// jen ta kola, ve kterých už existují tipovatelné zápasy (mají oba týmy).
const KNOCKOUT_COLUMNS = [
  { stage: "ROUND_OF_32", label: "Šestnáctifinále" },
  { stage: "ROUND_OF_16", label: "Osmifinále" },
  { stage: "QUARTER_FINAL", label: "Čtvrtfinále" },
  { stage: "SEMI_FINAL", label: "Semifinále" },
  { stage: "THIRD_PLACE", label: "O 3. místo" },
  { stage: "FINAL", label: "Finále" },
] as const;

// Co se očekává v každé kategorii „kompletního" tipéra.
const SPECIAL_TOTAL = 2 + GROUP_LETTERS.length; // vítěz + král střelců turnaje + 12 skupin
const RANKING_TOTAL = GROUP_LETTERS.length; // 12 skupin
const ADVANCERS_TOTAL = KNOCKOUT_ADVANCERS_ROUNDS.length; // 6 kol

// Cílový počet týmů u jednotlivých postupových kol (R32 = 32 atd.).
const ADVANCERS_TARGET = new Map(
  KNOCKOUT_ADVANCERS_ROUNDS.map((r) => [r.stage as string, r.targetCount])
);

type Row = {
  userId: string;
  name: string;
  isAdmin: boolean;
  paid: boolean;
  /// Tipy na skupinové zápasy.
  groupMatches: number;
  /// Tipy na zápasy vyřazovací fáze po kolech (stage → počet).
  knockout: Record<string, number>;
  /// Součet všech zápasových tipů (skupiny + vyřazovací) pro výpočet kompletnosti.
  matches: number;
  rankings: number;
  specials: number;
  advancers: number;
};

export default async function AdminKontrolaPage() {
  const session = await requireAdmin("/admin/kontrola");

  // Hratelné zápasy = mají oba týmy (knockout placeholdery bez týmů nepočítáme).
  const tippableMatches = await db.match.findMany({
    where: { homeTeamId: { not: null }, awayTeamId: { not: null } },
    select: { id: true, stage: true },
  });
  const tippableIds = tippableMatches.map((m) => m.id);
  const matchesTotal = tippableIds.length;

  // Fáze podle zápasu + celkové počty zápasů na skupiny / jednotlivá kola.
  const stageById = new Map(tippableMatches.map((m) => [m.id, m.stage as string]));
  const groupTotal = tippableMatches.filter((m) => m.stage === "GROUP").length;
  const knockoutTotals = new Map<string, number>();
  for (const m of tippableMatches) {
    if (m.stage === "GROUP") continue;
    knockoutTotals.set(m.stage, (knockoutTotals.get(m.stage) ?? 0) + 1);
  }
  const knockoutTotal = matchesTotal - groupTotal;
  // Jen kola s aspoň jedním zápasem se zobrazí jako sloupec.
  const presentKnockout = KNOCKOUT_COLUMNS.filter(
    (c) => (knockoutTotals.get(c.stage) ?? 0) > 0
  );

  const [users, tips, rankings, specials, advancers] = await Promise.all([
    db.user.findMany({
      select: { id: true, name: true, email: true, isAdmin: true, paid: true },
    }),
    db.tip.findMany({
      where: { matchId: { in: tippableIds } },
      select: { userId: true, matchId: true },
    }),
    db.groupRankingTip.findMany({
      select: { userId: true, teamCodes: true },
    }),
    db.specialTip.findMany({
      select: { userId: true, type: true, value: true },
    }),
    db.knockoutAdvancersTip.findMany({
      select: { userId: true, stage: true, teamCodes: true },
    }),
  ]);

  // Tipy na zápasy rozpadnuté na skupiny a jednotlivá kola vyřazovací fáze.
  const groupByUser = new Map<string, number>();
  const knockoutByUser = new Map<string, Map<string, number>>();
  for (const t of tips) {
    const stage = stageById.get(t.matchId);
    if (!stage) continue;
    if (stage === "GROUP") {
      groupByUser.set(t.userId, (groupByUser.get(t.userId) ?? 0) + 1);
    } else {
      let m = knockoutByUser.get(t.userId);
      if (!m) {
        m = new Map();
        knockoutByUser.set(t.userId, m);
      }
      m.set(stage, (m.get(stage) ?? 0) + 1);
    }
  }

  // Pořadí skupin: započítáme jen kompletní (4 týmy).
  const rankingByUser = new Map<string, number>();
  for (const r of rankings) {
    if (r.teamCodes.length !== 4) continue;
    rankingByUser.set(r.userId, (rankingByUser.get(r.userId) ?? 0) + 1);
  }

  // Speciální tipy: vítěz, král střelců turnaje, 12 králů skupin — jen neprázdné.
  const SPECIAL_TYPES = new Set([
    "TOURNAMENT_WINNER",
    "TOP_SCORER_TOURNAMENT",
    ...GROUP_LETTERS.map((g) => `TOP_SCORER_GROUP_${g}`),
  ]);
  const specialByUser = new Map<string, number>();
  for (const s of specials) {
    if (!SPECIAL_TYPES.has(s.type)) continue;
    if (s.value.trim() === "") continue;
    specialByUser.set(s.userId, (specialByUser.get(s.userId) ?? 0) + 1);
  }

  // Postupující: kolo je hotové, když má přesně cílový počet týmů.
  const advancersByUser = new Map<string, number>();
  for (const a of advancers) {
    const target = ADVANCERS_TARGET.get(a.stage);
    if (target == null || a.teamCodes.length !== target) continue;
    advancersByUser.set(a.userId, (advancersByUser.get(a.userId) ?? 0) + 1);
  }

  const rows: Row[] = users.map((u) => {
    const groupMatches = groupByUser.get(u.id) ?? 0;
    const km = knockoutByUser.get(u.id);
    const knockout: Record<string, number> = {};
    let knockoutSum = 0;
    for (const c of KNOCKOUT_COLUMNS) {
      const v = km?.get(c.stage) ?? 0;
      knockout[c.stage] = v;
      knockoutSum += v;
    }
    return {
      userId: u.id,
      name: u.name ?? u.email ?? "(bez jména)",
      isAdmin: u.isAdmin,
      paid: u.paid,
      groupMatches,
      knockout,
      matches: groupMatches + knockoutSum,
      rankings: rankingByUser.get(u.id) ?? 0,
      specials: specialByUser.get(u.id) ?? 0,
      advancers: advancersByUser.get(u.id) ?? 0,
    };
  });

  const perUserTotal = matchesTotal + RANKING_TOTAL + SPECIAL_TOTAL + ADVANCERS_TOTAL;
  const doneSum = (r: Row) =>
    r.matches + r.rankings + r.specials + r.advancers;
  const isComplete = (r: Row) =>
    r.matches >= matchesTotal &&
    r.rankings >= RANKING_TOTAL &&
    r.specials >= SPECIAL_TOTAL &&
    r.advancers >= ADVANCERS_TOTAL;

  // Pořadí: 1) nezaplacení nahoru, 2) pak nehotoví (kdo nemá „Hotovo"),
  // 3) v rámci toho nejvíc chybějících první, 4) nakonec podle jména.
  rows.sort((a, b) => {
    if (a.paid !== b.paid) return a.paid ? 1 : -1;
    const ca = isComplete(a);
    const cb = isComplete(b);
    if (ca !== cb) return ca ? 1 : -1;
    const da = perUserTotal - doneSum(a);
    const db_ = perUserTotal - doneSum(b);
    if (da !== db_) return db_ - da;
    return a.name.localeCompare(b.name, "cs-CZ");
  });

  const completeCount = rows.filter(isComplete).length;

  return (
    <div className="flex flex-1 flex-col bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <div className="min-w-0">
            <Link
              href="/admin"
              className="text-xs uppercase tracking-wider text-slate-500 hover:text-slate-700"
            >
              ← Admin
            </Link>
            <h1 className="text-lg font-bold tracking-tight sm:text-xl">
              Kontrola vyplnění a zaplacení
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

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
          Přehled, kdo má vyplněno všechno. Zeleně = hotovo, oranžově = něco
          chybí, šedě = zatím nic.{" "}
          <span className="font-medium text-slate-800">
            {completeCount} / {rows.length}
          </span>{" "}
          tipérů má kompletně vyplněno.
        </div>

        {/* Mobil: karty (tabulka by se nevešla na úzkou obrazovku). */}
        <ul className="flex flex-col gap-3 sm:hidden">
          {rows.map((r) => {
            const complete = isComplete(r);
            return (
              <li
                key={r.userId}
                className="rounded-xl border border-slate-200 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="font-medium text-slate-900">{r.name}</span>
                    {r.isAdmin && (
                      <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                        admin
                      </span>
                    )}
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                      complete
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    )}
                  >
                    {complete ? "Hotovo" : `Chybí ${perUserTotal - doneSum(r)}`}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <CountChip label="Skupiny" done={r.groupMatches} total={groupTotal} />
                  <CountChip label="Pořadí" done={r.rankings} total={RANKING_TOTAL} />
                  <CountChip label="Speciální" done={r.specials} total={SPECIAL_TOTAL} />
                  <CountChip label="Postupující" done={r.advancers} total={ADVANCERS_TOTAL} />
                </div>

                {presentKnockout.length > 0 && (
                  <div className="mt-3">
                    <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                      Vyřazovací fáze
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {presentKnockout.map((c) => (
                        <CountChip
                          key={c.stage}
                          label={c.label}
                          done={r.knockout[c.stage]}
                          total={knockoutTotals.get(c.stage) ?? 0}
                        />
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-3 border-t border-slate-100 pt-3">
                  <PaidToggle userId={r.userId} initialPaid={r.paid} />
                </div>
              </li>
            );
          })}
          {rows.length === 0 && (
            <li className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-slate-500">
              Zatím žádní registrovaní tipéři.
            </li>
          )}
        </ul>

        {/* Desktop: plná tabulka. */}
        <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white sm:block">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <th
                  rowSpan={2}
                  className="border-b border-slate-200 px-4 py-3 align-bottom font-semibold"
                >
                  Tipér
                </th>
                <th
                  rowSpan={2}
                  className="border-b border-l border-slate-200 px-3 py-3 text-center align-bottom font-semibold"
                >
                  Skupiny
                </th>
                {presentKnockout.length > 0 && (
                  <th
                    colSpan={presentKnockout.length}
                    className="border-b border-l border-slate-200 px-3 py-2 text-center font-semibold"
                  >
                    Vyřazovací fáze
                  </th>
                )}
                <th
                  rowSpan={2}
                  className="border-b border-l border-slate-200 px-3 py-3 text-center align-bottom font-semibold"
                >
                  Pořadí
                </th>
                <th
                  rowSpan={2}
                  className="border-b border-slate-200 px-3 py-3 text-center align-bottom font-semibold"
                >
                  Speciální
                </th>
                <th
                  rowSpan={2}
                  className="border-b border-slate-200 px-3 py-3 text-center align-bottom font-semibold"
                >
                  Postupující
                </th>
                <th
                  rowSpan={2}
                  className="border-b border-slate-200 px-3 py-3 text-center align-bottom font-semibold"
                >
                  Stav
                </th>
                <th
                  rowSpan={2}
                  className="border-b border-slate-200 px-3 py-3 text-center align-bottom font-semibold"
                >
                  Zaplaceno
                </th>
              </tr>
              {presentKnockout.length > 0 && (
                <tr className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-400">
                  {presentKnockout.map((c, i) => (
                    <th
                      key={c.stage}
                      className={cn(
                        "border-b border-slate-200 px-2 py-1.5 text-center font-medium",
                        i === 0 && "border-l"
                      )}
                    >
                      {c.label}
                    </th>
                  ))}
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => {
                const complete = isComplete(r);
                return (
                  <tr key={r.userId} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-900">
                        {r.name}
                      </span>
                      {r.isAdmin && (
                        <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                          admin
                        </span>
                      )}
                    </td>
                    <CountCell
                      done={r.groupMatches}
                      total={groupTotal}
                      className="border-l border-slate-200"
                    />
                    {presentKnockout.map((c, i) => (
                      <CountCell
                        key={c.stage}
                        done={r.knockout[c.stage]}
                        total={knockoutTotals.get(c.stage) ?? 0}
                        className={i === 0 ? "border-l border-slate-200" : undefined}
                      />
                    ))}
                    <CountCell
                      done={r.rankings}
                      total={RANKING_TOTAL}
                      className="border-l border-slate-200"
                    />
                    <CountCell done={r.specials} total={SPECIAL_TOTAL} />
                    <CountCell done={r.advancers} total={ADVANCERS_TOTAL} />
                    <td className="px-3 py-3 text-center">
                      <span
                        className={cn(
                          "inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold",
                          complete
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                        )}
                      >
                        {complete
                          ? "Hotovo"
                          : `Chybí ${perUserTotal - doneSum(r)}`}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <PaidToggle userId={r.userId} initialPaid={r.paid} />
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={7 + presentKnockout.length}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    Zatím žádní registrovaní tipéři.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs text-slate-500">
          Kompletní = {groupTotal} zápasů skupin
          {knockoutTotal > 0 && ` · ${knockoutTotal} zápasů vyřazovací fáze`} ·{" "}
          {RANKING_TOTAL} pořadí skupin · {SPECIAL_TOTAL} speciálních tipů ·{" "}
          {ADVANCERS_TOTAL} postupových kol.
        </p>
      </main>
    </div>
  );
}

function CountCell({
  done,
  total,
  className,
}: {
  done: number;
  total: number;
  className?: string;
}) {
  const complete = done >= total && total > 0;
  const empty = done === 0;
  return (
    <td className={cn("px-3 py-3 text-center", className)}>
      <span
        className={cn(
          "font-medium tabular-nums",
          complete
            ? "text-emerald-700"
            : empty
              ? "text-slate-400"
              : "text-amber-700"
        )}
      >
        {done} / {total}
      </span>
    </td>
  );
}

/** Stejná čísla jako CountCell, ale jako štítek do mobilní karty. */
function CountChip({
  label,
  done,
  total,
}: {
  label: string;
  done: number;
  total: number;
}) {
  const complete = done >= total && total > 0;
  const empty = done === 0;
  return (
    <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
      <span className="text-slate-500">{label}</span>
      <span
        className={cn(
          "font-medium tabular-nums",
          complete
            ? "text-emerald-700"
            : empty
              ? "text-slate-400"
              : "text-amber-700"
        )}
      >
        {done} / {total}
      </span>
    </div>
  );
}
