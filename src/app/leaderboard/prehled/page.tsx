import Link from "next/link";
import { Lock } from "lucide-react";

import { OverviewClient } from "@/components/overview-client";
import { isDeadlinePassed, tournament } from "@/config/tournament";
import { requireSession } from "@/lib/auth-guards";
import { db } from "@/lib/db";
import { KNOCKOUT_ADVANCERS_ROUNDS } from "@/lib/knockout-rounds";
import {
  SCORING,
  scoreAdvancers,
  scoreGroupRanking,
  scoreMatchTip,
  scorePlayerName,
  scoreTournamentWinner,
} from "@/lib/scoring";

const deadlineDateFormatter = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Prague",
});

export default async function PrehledPage() {
  const session = await requireSession("/leaderboard/prehled");
  const currentUserId = session.user.id;
  const now = new Date();

  // Před uzávěrkou nikdo nevidí cizí tipy — celá matice je zamčená.
  if (!isDeadlinePassed(now)) {
    return (
      <div className="flex flex-1 flex-col bg-slate-50 text-slate-900">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
            <div>
              <Link
                href="/leaderboard"
                className="text-xs uppercase tracking-wider text-slate-500 hover:text-slate-700"
              >
                ← Pořadí
              </Link>
              <h1 className="text-lg font-bold tracking-tight sm:text-xl">
                Kompletní přehled tipů
              </h1>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6">
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
            <div className="mx-auto mb-4 inline-flex size-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              <Lock className="size-5" />
            </div>
            <h2 className="text-lg font-semibold">Přehled je zamčený</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-slate-600">
              Po startu turnaje a uzávěrce tipů se tu zobrazí kompletní přehled
              tipů všech. Do té doby vidíš jen své vlastní ve{" "}
              <Link
                href="/formular"
                className="font-medium text-slate-900 underline-offset-4 hover:underline"
              >
                formuláři
              </Link>
              .
            </p>
            <p className="mt-4 text-xs text-slate-500">
              Uzávěrka:{" "}
              <strong>
                {deadlineDateFormatter.format(tournament.deadline)}
              </strong>
            </p>
          </div>
        </main>
      </div>
    );
  }

  const [
    users,
    matches,
    matchTips,
    teams,
    groupResults,
    groupTips,
    knockoutResults,
    knockoutTips,
    tournamentResults,
    specialTips,
  ] = await Promise.all([
    db.user.findMany({
      select: { id: true, name: true, email: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    db.match.findMany({
      where: { stage: "GROUP" },
      include: {
        homeTeam: { select: { code: true, name: true, flagEmoji: true } },
        awayTeam: { select: { code: true, name: true, flagEmoji: true } },
      },
      orderBy: [{ group: "asc" }, { dateUtc: "asc" }],
    }),
    db.tip.findMany({
      select: { userId: true, matchId: true, homeScore: true, awayScore: true },
    }),
    db.team.findMany({
      select: { code: true, name: true, flagEmoji: true, group: true },
    }),
    db.groupRankingResult.findMany({
      select: { group: true, teamCodes: true },
    }),
    db.groupRankingTip.findMany({
      select: { userId: true, group: true, teamCodes: true },
    }),
    db.knockoutAdvancersResult.findMany({
      select: { stage: true, teamCodes: true },
    }),
    db.knockoutAdvancersTip.findMany({
      select: { userId: true, stage: true, teamCodes: true },
    }),
    db.tournamentResult.findMany({
      select: { type: true, value: true },
    }),
    db.specialTip.findMany({
      select: { userId: true, type: true, value: true },
    }),
  ]);

  const teamByCode = new Map(teams.map((t) => [t.code, t]));

  // Pomocné indexy
  const matchTipKey = (uId: string, mId: string) => `${uId}__${mId}`;
  const matchTipMap = new Map<string, { home: number; away: number }>();
  for (const t of matchTips) {
    matchTipMap.set(matchTipKey(t.userId, t.matchId), {
      home: t.homeScore,
      away: t.awayScore,
    });
  }

  const groupRankingTipMap = new Map<string, string[]>();
  for (const t of groupTips) {
    groupRankingTipMap.set(`${t.userId}__${t.group}`, t.teamCodes);
  }
  const groupRankingResultMap = new Map<string, string[]>(
    groupResults.map((r) => [r.group as string, r.teamCodes])
  );

  const knockoutTipMap = new Map<string, string[]>();
  for (const t of knockoutTips) {
    knockoutTipMap.set(`${t.userId}__${t.stage}`, t.teamCodes);
  }
  const knockoutResultMap = new Map<string, string[]>(
    knockoutResults.map((r) => [r.stage as string, r.teamCodes])
  );

  const specialTipMap = new Map<string, string>();
  for (const t of specialTips) {
    specialTipMap.set(`${t.userId}__${t.type}`, t.value);
  }
  const tournamentResultMap = new Map(
    tournamentResults.map((r) => [r.type, r.value])
  );

  // Skupinová písmena (A–L)
  const groupLetters = Array.from(
    new Set(
      teams
        .map((t) => t.group)
        .filter((g): g is NonNullable<typeof g> => g !== null)
        .map((g) => g as string)
    )
  ).sort();

  // Vytvoříme sloupce (events) a poté řádky (tipéři) s buňkami
  type Column = {
    key: string;
    short: string; // hlavička, kratší
    sub?: string; // podtitulek
    real: string; // hodnota pro řádek "skutečně"
    cell: (userId: string) => { text: string; points: number };
  };

  const columns: Column[] = [];

  // --- Zápasy ---
  for (const m of matches) {
    const homeCode = m.homeTeam?.code ?? "?";
    const awayCode = m.awayTeam?.code ?? "?";
    const realScore =
      m.homeScore !== null && m.awayScore !== null
        ? `${m.homeScore}:${m.awayScore}`
        : "—";
    // Cizí tipy na zápas se odkryjí až po jeho výkopu.
    const revealed = new Date(m.dateUtc).getTime() <= now.getTime();
    columns.push({
      key: `m_${m.id}`,
      short: `${homeCode}–${awayCode}`,
      sub: `Sk. ${m.group ?? "?"}`,
      real: realScore,
      cell: (userId) => {
        if (!revealed && userId !== currentUserId) {
          return { text: "🔒", points: 0 };
        }
        const t = matchTipMap.get(matchTipKey(userId, m.id));
        if (!t) return { text: "—", points: 0 };
        const points =
          m.homeScore !== null && m.awayScore !== null
            ? scoreMatchTip(t.home, t.away, m.homeScore, m.awayScore)
            : 0;
        return { text: `${t.home}:${t.away}`, points };
      },
    });
  }

  // --- Pořadí skupin (4 pozice komprimované do 1 buňky) ---
  for (const g of groupLetters) {
    const real = groupRankingResultMap.get(g) ?? null;
    columns.push({
      key: `gr_${g}`,
      short: `Sk. ${g}`,
      sub: "pořadí",
      real: real ? real.join(" · ") : "—",
      cell: (userId) => {
        const tip = groupRankingTipMap.get(`${userId}__${g}`);
        if (!tip || tip.length < 4) return { text: "—", points: 0 };
        const points = scoreGroupRanking(tip, real);
        return { text: tip.join(" · "), points };
      },
    });
  }

  // --- Králové střelců skupin ---
  for (const g of groupLetters) {
    const realValue = tournamentResultMap.get(`TOP_SCORER_GROUP_${g}`) ?? null;
    columns.push({
      key: `gs_${g}`,
      short: `Sk. ${g}`,
      sub: "střelec",
      real: realValue ?? "—",
      cell: (userId) => {
        const tip = specialTipMap.get(`${userId}__TOP_SCORER_GROUP_${g}`);
        if (!tip) return { text: "—", points: 0 };
        const points = scorePlayerName(tip, realValue, SCORING.groupScorer);
        return { text: tip, points };
      },
    });
  }

  // --- Postupy ---
  for (const round of KNOCKOUT_ADVANCERS_ROUNDS) {
    const real = knockoutResultMap.get(round.stage) ?? null;
    const pointsPerTeam =
      SCORING.advancers[round.key as keyof typeof SCORING.advancers];
    columns.push({
      key: `adv_${round.key}`,
      short: round.label,
      sub: `${pointsPerTeam} b/tým`,
      real: real ? `${real.length} týmů` : "—",
      cell: (userId) => {
        const tip = knockoutTipMap.get(`${userId}__${round.stage}`);
        if (!tip || tip.length === 0) return { text: "—", points: 0 };
        const correct = real
          ? tip.filter((c) => real.includes(c)).length
          : null;
        const points = scoreAdvancers(tip, real, pointsPerTeam);
        const text = correct !== null
          ? `${tip.length} (✓${correct})`
          : `${tip.length} týmů`;
        return { text, points };
      },
    });
  }

  // --- Vítěz turnaje ---
  {
    const real = tournamentResultMap.get("TOURNAMENT_WINNER") ?? null;
    columns.push({
      key: "winner",
      short: "Vítěz",
      sub: "turnaje",
      real: real ? formatTeamShort(real, teamByCode) : "—",
      cell: (userId) => {
        const tip = specialTipMap.get(`${userId}__TOURNAMENT_WINNER`);
        if (!tip) return { text: "—", points: 0 };
        const points = scoreTournamentWinner(tip, real);
        return { text: formatTeamShort(tip, teamByCode), points };
      },
    });
  }

  // --- Král střelců turnaje ---
  {
    const real = tournamentResultMap.get("TOP_SCORER_TOURNAMENT") ?? null;
    columns.push({
      key: "topscorer",
      short: "Král střelců",
      sub: "turnaje",
      real: real ?? "—",
      cell: (userId) => {
        const tip = specialTipMap.get(`${userId}__TOP_SCORER_TOURNAMENT`);
        if (!tip) return { text: "—", points: 0 };
        const points = scorePlayerName(
          tip,
          real,
          SCORING.tournamentTopScorer
        );
        return { text: tip, points };
      },
    });
  }

  // Počet event sloupců na jednu tiskovou stránku.
  // A4 landscape (~28 cm) — tipér 4 cm + body 2 cm + ~10 sloupců × 2 cm.
  const EVENTS_PER_PAGE = 10;
  const eventChunks: Column[][] = [];
  for (let i = 0; i < columns.length; i += EVENTS_PER_PAGE) {
    eventChunks.push(columns.slice(i, i + EVENTS_PER_PAGE));
  }

  // Spočti řádky (tipéři) + celkové body
  const tipperRows = users.map((u) => {
    const cells = columns.map((col) => col.cell(u.id));
    const total = cells.reduce((sum, c) => sum + c.points, 0);
    return {
      userId: u.id,
      name: u.name ?? u.email,
      isMe: u.id === currentUserId,
      cells: cells.map((c, i) => ({
        key: columns[i].key,
        text: c.text,
        points: c.points,
      })),
      total,
    };
  });
  // Seřaď podle bodů desc, pak alphabeticky
  tipperRows.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    return a.name.localeCompare(b.name, "cs-CZ");
  });

  return (
    <div className="flex flex-1 flex-col bg-slate-50 text-slate-900 print:bg-white">
      {/* Landscape orientation jen pro tuto stránku */}
      <style>{`@media print { @page { size: A4 landscape; margin: 1cm; } }`}</style>

      <header className="border-b border-slate-200 bg-white print:hidden">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <div>
            <Link
              href="/leaderboard"
              className="text-xs uppercase tracking-wider text-slate-500 hover:text-slate-700"
            >
              ← Pořadí
            </Link>
            <h1 className="text-lg font-bold tracking-tight sm:text-xl">
              Kompletní přehled tipů
            </h1>
          </div>
          <OverviewClient
            columns={columns.map((c) => ({ key: c.key, short: c.short, sub: c.sub, real: c.real }))}
            rows={tipperRows}
          />
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-4 sm:px-6 print:max-w-full print:px-0 print:py-0">
        <p className="mb-3 text-xs text-slate-500 print:hidden">
          Tabulka je široká — posuň ji vodorovně. První sloupec (jméno) zůstane
          při scrollování ukotvený. Pro tisk plakátu se matice rozdělí na{" "}
          {eventChunks.length} A4 landscape stránek, které slepíš.
        </p>

        {/* ============================================================
            Verze pro web (široká scroll matice). Skrytá v tisku.
            ============================================================ */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white print:hidden">
          <table className="min-w-max text-xs print:text-[8pt]">
            <thead className="bg-slate-50 print:bg-white">
              <tr className="border-b border-slate-200 text-left print:border-slate-400">
                <th className="sticky left-0 z-10 bg-slate-50 px-2 py-2 font-semibold print:bg-white">
                  Tipér
                </th>
                {columns.map((c) => (
                  <th
                    key={c.key}
                    className="border-l border-slate-100 px-2 py-2 font-semibold whitespace-nowrap print:border-slate-300"
                    title={`${c.short}${c.sub ? " — " + c.sub : ""}`}
                  >
                    <div>{c.short}</div>
                    {c.sub && (
                      <div className="text-[10px] font-normal text-slate-500 print:text-[6pt]">
                        {c.sub}
                      </div>
                    )}
                  </th>
                ))}
                <th className="sticky right-0 z-10 border-l border-slate-200 bg-slate-50 px-2 py-2 text-right font-semibold print:bg-white">
                  Body
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 print:divide-slate-300">
              {/* Skutečné výsledky */}
              <tr className="bg-amber-50 font-medium print:bg-slate-100">
                <td className="sticky left-0 z-10 bg-amber-50 px-2 py-2 print:bg-slate-100">
                  Skutečně
                </td>
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className="border-l border-slate-100 px-2 py-2 whitespace-nowrap text-slate-900 print:border-slate-300"
                    title={c.real}
                  >
                    {truncate(c.real, 24)}
                  </td>
                ))}
                <td className="sticky right-0 z-10 border-l border-slate-200 bg-amber-50 px-2 py-2 text-right text-slate-500 print:bg-slate-100">
                  —
                </td>
              </tr>

              {/* Tipy */}
              {tipperRows.map((row) => (
                <tr
                  key={row.userId}
                  className={row.isMe ? "bg-amber-50/40" : ""}
                >
                  <td
                    className={`sticky left-0 z-10 px-2 py-2 font-medium ${row.isMe ? "bg-amber-50/70" : "bg-white"}`}
                  >
                    {row.name}
                    {row.isMe && (
                      <span className="ml-1 text-[10px] text-amber-700">
                        (ty)
                      </span>
                    )}
                  </td>
                  {row.cells.map((cell) => (
                    <td
                      key={cell.key}
                      className={`border-l border-slate-100 px-2 py-2 whitespace-nowrap ${
                        cell.points > 0 ? "text-emerald-700" : "text-slate-600"
                      }`}
                      title={cell.text}
                    >
                      {truncate(cell.text, 24)}
                    </td>
                  ))}
                  <td
                    className={`sticky right-0 z-10 border-l border-slate-200 px-2 py-2 text-right font-semibold tabular-nums ${row.isMe ? "bg-amber-50/70" : "bg-white"}`}
                  >
                    {row.total}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ============================================================
            Verze pro tisk (plakát). Skrytá na webu — viditelná jen v
            print. Každý chunk = jedna A4 landscape stránka.
            ============================================================ */}
        <div className="hidden print:block">
          {eventChunks.map((chunk, idx) => {
            const isLast = idx === eventChunks.length - 1;
            return (
              <section
                key={idx}
                className={idx > 0 ? "break-before-page" : ""}
              >
                <div className="mb-2 flex items-baseline justify-between border-b border-slate-400 pb-1">
                  <h2 className="text-sm font-bold">
                    {tournament.name} — Kompletní přehled tipů
                  </h2>
                  <p className="text-[8pt] text-slate-600">
                    Strana {idx + 1} / {eventChunks.length}
                  </p>
                </div>
                <table className="w-full text-[8pt]">
                  <thead>
                    <tr className="border-b border-slate-400">
                      <th className="px-1.5 py-1 text-left font-semibold">
                        Tipér
                      </th>
                      {chunk.map((c) => (
                        <th
                          key={c.key}
                          className="border-l border-slate-300 px-1.5 py-1 text-left font-semibold align-bottom"
                        >
                          <div className="leading-tight">{c.short}</div>
                          {c.sub && (
                            <div className="text-[6pt] font-normal text-slate-600 leading-tight">
                              {c.sub}
                            </div>
                          )}
                        </th>
                      ))}
                      {isLast && (
                        <th className="border-l border-slate-400 px-1.5 py-1 text-right font-semibold">
                          Body
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Skutečné výsledky */}
                    <tr className="border-b border-slate-300 bg-slate-100 font-medium">
                      <td className="px-1.5 py-1">Skutečně</td>
                      {chunk.map((c) => (
                        <td
                          key={c.key}
                          className="border-l border-slate-300 px-1.5 py-1"
                        >
                          {truncate(c.real, 20)}
                        </td>
                      ))}
                      {isLast && (
                        <td className="border-l border-slate-400 px-1.5 py-1 text-right">
                          —
                        </td>
                      )}
                    </tr>
                    {/* Tipy */}
                    {tipperRows.map((row) => {
                      const chunkStart = idx * EVENTS_PER_PAGE;
                      const chunkEnd = chunkStart + chunk.length;
                      const chunkCells = row.cells.slice(chunkStart, chunkEnd);
                      return (
                        <tr
                          key={row.userId}
                          className="border-b border-slate-200"
                        >
                          <td className="px-1.5 py-1 font-medium whitespace-nowrap">
                            {row.name}
                          </td>
                          {chunkCells.map((cell) => (
                            <td
                              key={cell.key}
                              className="border-l border-slate-300 px-1.5 py-1"
                            >
                              {truncate(cell.text, 20)}
                            </td>
                          ))}
                          {isLast && (
                            <td className="border-l border-slate-400 px-1.5 py-1 text-right font-semibold tabular-nums">
                              {row.total}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {idx === 0 && eventChunks.length > 1 && (
                  <p className="mt-3 text-[7pt] italic text-slate-600">
                    Pro plakát: vytiskni všech {eventChunks.length} stran,
                    ořízni okraje vpravo a vlevo (zachovej jen sloupec
                    &laquo;Tipér&raquo; na první straně) a slep stránky
                    horizontálně za sebou.
                  </p>
                )}
              </section>
            );
          })}
        </div>
      </main>
    </div>
  );
}

function formatTeamShort(
  code: string,
  teamByCode: Map<string, { name: string; flagEmoji: string | null }>
): string {
  const t = teamByCode.get(code);
  if (!t) return code;
  return t.flagEmoji ? `${t.flagEmoji} ${t.name}` : t.name;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}
