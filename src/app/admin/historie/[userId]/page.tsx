import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { notFound } from "next/navigation";

import { DeleteUserButton } from "@/components/delete-user-button";
import { tournament } from "@/config/tournament";
import { requireAdmin } from "@/lib/auth-guards";
import { db } from "@/lib/db";

const dateTimeFormatter = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  timeZone: "Europe/Prague",
});

const STAGE_LABEL: Record<string, string> = {
  ROUND_OF_32: "Šestnáctifinále",
  ROUND_OF_16: "Osmifinále",
  QUARTER_FINAL: "Čtvrtfinále",
  SEMI_FINAL: "Semifinále",
  THIRD_PLACE: "O 3. místo",
  FINAL: "Finále",
};

function labelForEntity(entityType: string, entityKey: string): string {
  switch (entityType) {
    case "MATCH_TIP":
      return "Tip na zápas";
    case "GROUP_RANKING":
      return `Pořadí skupiny ${entityKey}`;
    case "KNOCKOUT_ADVANCERS":
      return `Postupující — ${STAGE_LABEL[entityKey] ?? entityKey}`;
    case "SPECIAL_TIP": {
      if (entityKey === "TOURNAMENT_WINNER") return "Vítěz turnaje";
      if (entityKey === "TOP_SCORER_TOURNAMENT") return "Král střelců turnaje";
      const m = entityKey.match(/^TOP_SCORER_GROUP_([A-L])$/);
      if (m) return `Král střelců skupiny ${m[1]}`;
      return entityKey;
    }
    default:
      return entityType;
  }
}

type MatchInfo = { home: string; away: string; group: string | null; stage: string };

function formatTeamCode(
  code: string,
  teamByCode: Map<string, { name: string; flagEmoji: string | null }>
): string {
  const t = teamByCode.get(code);
  if (!t) return code;
  return t.flagEmoji ? `${t.flagEmoji} ${t.name}` : t.name;
}

function renderValue(
  entityType: string,
  entityKey: string,
  raw: unknown,
  matchById: Map<string, MatchInfo>,
  teamByCode: Map<string, { name: string; flagEmoji: string | null }>
): string {
  if (raw === null || raw === undefined) return "—";

  switch (entityType) {
    case "MATCH_TIP": {
      const v = raw as { homeScore?: number; awayScore?: number };
      if (typeof v.homeScore !== "number" || typeof v.awayScore !== "number") {
        return "—";
      }
      const m = matchById.get(entityKey);
      if (!m) return `${v.homeScore} : ${v.awayScore}`;
      const home = formatTeamCode(m.home, teamByCode);
      const away = formatTeamCode(m.away, teamByCode);
      return `${home} ${v.homeScore} : ${v.awayScore} ${away}`;
    }
    case "GROUP_RANKING": {
      const v = raw as { teamCodes?: string[] };
      if (!Array.isArray(v.teamCodes)) return "—";
      return v.teamCodes
        .map((c, i) => `${i + 1}. ${formatTeamCode(c, teamByCode)}`)
        .join(" · ");
    }
    case "KNOCKOUT_ADVANCERS": {
      const v = raw as { teamCodes?: string[] };
      if (!Array.isArray(v.teamCodes) || v.teamCodes.length === 0) return "—";
      return v.teamCodes.map((c) => formatTeamCode(c, teamByCode)).join(", ");
    }
    case "SPECIAL_TIP": {
      const v = raw as { value?: string };
      if (typeof v.value !== "string" || v.value === "") return "—";
      if (entityKey === "TOURNAMENT_WINNER") {
        return formatTeamCode(v.value, teamByCode);
      }
      return v.value;
    }
    default:
      return JSON.stringify(raw);
  }
}

export default async function AdminHistoryDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const session = await requireAdmin(`/admin/historie/${userId}`);

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true },
  });
  if (!user) notFound();

  const logs = await db.tipChangeLog.findMany({
    where: { userId },
    orderBy: { changedAt: "desc" },
    select: {
      id: true,
      entityType: true,
      entityKey: true,
      oldValue: true,
      newValue: true,
      changedAt: true,
    },
  });

  // Předem si načteme info o zápasech a týmech pro pěkné rendering tipů
  const matchIds = Array.from(
    new Set(logs.filter((l) => l.entityType === "MATCH_TIP").map((l) => l.entityKey))
  );

  const [matches, teams] = await Promise.all([
    matchIds.length > 0
      ? db.match.findMany({
          where: { id: { in: matchIds } },
          select: {
            id: true,
            stage: true,
            group: true,
            homeTeam: { select: { code: true } },
            awayTeam: { select: { code: true } },
          },
        })
      : Promise.resolve([]),
    db.team.findMany({ select: { code: true, name: true, flagEmoji: true } }),
  ]);

  const matchById = new Map<string, MatchInfo>(
    matches
      .filter((m) => m.homeTeam && m.awayTeam)
      .map((m) => [
        m.id,
        {
          home: m.homeTeam!.code,
          away: m.awayTeam!.code,
          group: m.group,
          stage: m.stage,
        },
      ])
  );
  const teamByCode = new Map(
    teams.map((t) => [t.code, { name: t.name, flagEmoji: t.flagEmoji }])
  );

  const isSelf = session.user.id === user.id;

  return (
    <div className="flex flex-1 flex-col bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <div className="min-w-0">
            <Link
              href="/admin/historie"
              className="text-xs uppercase tracking-wider text-slate-500 hover:text-slate-700"
            >
              ← Historie tipů
            </Link>
            <h1 className="truncate text-lg font-bold tracking-tight sm:text-xl">
              {user.name ?? user.email}
            </h1>
            {user.name && (
              <p className="truncate text-xs text-slate-500">{user.email}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {!isSelf && (
              <DeleteUserButton
                userId={user.id}
                userLabel={user.name ?? user.email}
                redirectTo="/admin/historie"
                variant="button"
              />
            )}
            <p className="hidden text-xs text-slate-500 sm:block">
              {tournament.shortName} ·{" "}
              <span className="font-medium text-slate-700">
                {session.user.name ?? session.user.email}
              </span>
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {logs.length === 0 ? (
          <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">
            Tento uživatel zatím neuložil žádný tip.
          </p>
        ) : (
          <>
            <p className="mb-4 text-sm text-slate-600">
              <strong>{logs.length}</strong>{" "}
              {logs.length === 1 ? "změna" : logs.length < 5 ? "změny" : "změn"}{" "}
              od nejnovější po nejstarší.
            </p>
            <ol className="space-y-2">
              {logs.map((log) => {
                const isCreate = log.oldValue === null;
                const isDelete = log.newValue === null;
                return (
                  <li
                    key={log.id}
                    className="rounded-lg border border-slate-200 bg-white p-4"
                  >
                    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">
                        {labelForEntity(log.entityType, log.entityKey)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {dateTimeFormatter.format(log.changedAt)}
                      </p>
                    </div>
                    <div className="space-y-1 text-sm">
                      {isCreate ? (
                        <p>
                          <span className="mr-2 inline-block rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-700">
                            vytvořeno
                          </span>
                          <span className="text-slate-900">
                            {renderValue(
                              log.entityType,
                              log.entityKey,
                              log.newValue,
                              matchById,
                              teamByCode
                            )}
                          </span>
                        </p>
                      ) : isDelete ? (
                        <p>
                          <span className="mr-2 inline-block rounded bg-rose-50 px-1.5 py-0.5 text-xs font-medium text-rose-700">
                            smazáno
                          </span>
                          <span className="text-slate-500 line-through">
                            {renderValue(
                              log.entityType,
                              log.entityKey,
                              log.oldValue,
                              matchById,
                              teamByCode
                            )}
                          </span>
                        </p>
                      ) : (
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                          <span className="text-slate-500 line-through">
                            {renderValue(
                              log.entityType,
                              log.entityKey,
                              log.oldValue,
                              matchById,
                              teamByCode
                            )}
                          </span>
                          <ArrowRight className="hidden size-4 shrink-0 text-slate-400 sm:inline" />
                          <span className="text-slate-900">
                            {renderValue(
                              log.entityType,
                              log.entityKey,
                              log.newValue,
                              matchById,
                              teamByCode
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </main>
    </div>
  );
}
