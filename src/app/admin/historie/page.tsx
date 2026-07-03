import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { DeleteUserButton } from "@/components/delete-user-button";
import { tournament } from "@/config/tournament";
import { requireAdmin } from "@/lib/auth-guards";
import { db } from "@/lib/db";
import { PAGE_WIDTH } from "@/lib/layout";

const dateFormatter = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Prague",
});

export default async function AdminHistoriePage() {
  const session = await requireAdmin("/admin/historie");
  const currentUserId = session.user.id;

  const [users, logCounts] = await Promise.all([
    db.user.findMany({
      select: { id: true, name: true, email: true },
      orderBy: { createdAt: "asc" },
    }),
    db.tipChangeLog.groupBy({
      by: ["userId"],
      _count: { _all: true },
      _max: { changedAt: true },
    }),
  ]);

  const statsByUser = new Map(
    logCounts.map((c) => [c.userId, { count: c._count._all, last: c._max.changedAt }])
  );

  const rows = users
    .map((u) => ({
      ...u,
      stats: statsByUser.get(u.id),
    }))
    .sort((a, b) => {
      const aTs = a.stats?.last?.getTime() ?? 0;
      const bTs = b.stats?.last?.getTime() ?? 0;
      return bTs - aTs;
    });

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
              Historie tipů
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
        <p className="mb-4 text-sm text-slate-600">
          Append-only log všech změn tipů. Použij k dohledání, co měl uživatel
          uložené v určitý moment (např. spor o tip před deadlinem).
        </p>

        {rows.length === 0 ? (
          <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">
            Zatím žádní tipéři.
          </p>
        ) : (
          <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {rows.map((u) => {
              const isSelf = u.id === currentUserId;
              return (
                <li
                  key={u.id}
                  className="flex items-center gap-2 pr-3 hover:bg-slate-50"
                >
                  <Link
                    href={`/admin/historie/${u.id}`}
                    className="flex flex-1 items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">
                        {u.name ?? (
                          <span className="italic text-slate-500">
                            (bez jména)
                          </span>
                        )}
                        {isSelf && (
                          <span className="ml-2 text-xs font-normal text-slate-500">
                            (ty)
                          </span>
                        )}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {u.email}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 text-right">
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {u.stats?.count ?? 0}{" "}
                          <span className="text-xs font-normal text-slate-500">
                            {u.stats?.count === 1 ? "změna" : "změn"}
                          </span>
                        </p>
                        <p className="text-xs text-slate-500">
                          {u.stats?.last
                            ? `naposledy ${dateFormatter.format(u.stats.last)}`
                            : "žádné změny"}
                        </p>
                      </div>
                      <ArrowRight className="size-4 text-slate-400" />
                    </div>
                  </Link>
                  {!isSelf && (
                    <DeleteUserButton
                      userId={u.id}
                      userLabel={u.name ?? u.email}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
