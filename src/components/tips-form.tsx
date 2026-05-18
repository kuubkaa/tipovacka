"use client";

import { useActionState } from "react";
import { Check, Loader2 } from "lucide-react";

import { saveTipsAction, type SaveTipsResult } from "@/app/formular/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// shadcn `Input` v této verzi (base-ui) nepředává `name` na nativní DOM input,
// což rozbíjí FormData. Použijeme native <input> se stejným stylem.
const scoreInputClass =
  "h-10 w-12 rounded-lg border border-slate-300 bg-white px-1 text-center text-base font-medium text-slate-900 tabular-nums outline-none transition-colors focus-visible:border-slate-900 focus-visible:ring-2 focus-visible:ring-slate-900/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500";

const matchDateFormatter = new Intl.DateTimeFormat("cs-CZ", {
  weekday: "short",
  day: "numeric",
  month: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

interface TeamRef {
  code: string;
  name: string;
  flagEmoji: string | null;
}

interface MatchData {
  id: string;
  matchKey: string;
  dateIso: string;
  home: TeamRef;
  away: TeamRef;
  existingTip: { homeScore: number; awayScore: number } | null;
}

interface GroupData {
  group: string;
  matches: MatchData[];
}

export function TipsForm({
  groups,
  disabled,
}: {
  groups: GroupData[];
  disabled: boolean;
}) {
  const [state, formAction, pending] = useActionState<
    SaveTipsResult | null,
    FormData
  >(saveTipsAction, null);

  return (
    <form action={formAction} className="space-y-8">
      {groups.map((g) => (
        <section
          key={g.group}
          className="overflow-hidden rounded-xl border border-slate-200 bg-white"
        >
          <header className="border-b border-slate-200 bg-slate-50 px-4 py-2.5">
            <h2 className="text-sm font-semibold tracking-wide text-slate-700">
              Skupina {g.group}
            </h2>
          </header>

          <ul className="divide-y divide-slate-100">
            {g.matches.map((m) => (
              <MatchRow key={m.id} match={m} disabled={disabled} />
            ))}
          </ul>
        </section>
      ))}

      {/* Sticky save bar */}
      <div className="sticky bottom-0 -mx-6 border-t border-slate-200 bg-white/95 px-6 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm text-slate-600">
            {state?.status === "ok" && (
              <span className="inline-flex items-center gap-1.5 text-emerald-700">
                <Check className="size-4" /> Uloženo {state.saved} tipů
              </span>
            )}
            {state?.status === "deadline" && (
              <span className="text-rose-700">Deadline uplynul, nejde uložit.</span>
            )}
            {state?.status === "unauth" && (
              <span className="text-rose-700">Nejsi přihlášen.</span>
            )}
            {state?.status === "error" && (
              <span className="text-rose-700">Chyba: {state.message}</span>
            )}
          </div>
          <Button
            type="submit"
            disabled={disabled || pending}
            className="h-10 rounded-lg bg-slate-900 px-5 text-sm font-medium text-white hover:bg-slate-800 disabled:bg-slate-300"
          >
            {pending ? (
              <>
                <Loader2 className="mr-1.5 size-4 animate-spin" />
                Ukládám…
              </>
            ) : disabled ? (
              "Tipy uzamčené"
            ) : (
              "Uložit tipy"
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}

function MatchRow({
  match,
  disabled,
}: {
  match: MatchData;
  disabled: boolean;
}) {
  const date = new Date(match.dateIso);
  return (
    <li className="px-4 py-3">
      <p className="mb-2 text-[11px] uppercase tracking-wide text-slate-400">
        {matchDateFormatter.format(date)}
      </p>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        {/* Home team */}
        <div className="flex items-center justify-end gap-2 text-sm font-medium text-slate-900">
          <span className="text-right">{match.home.name}</span>
          <span className="text-xl leading-none">{match.home.flagEmoji}</span>
        </div>

        {/* Score inputs */}
        <div className="flex items-center gap-1.5">
          <input
            name={`home_${match.id}`}
            type="number"
            min={0}
            max={20}
            inputMode="numeric"
            defaultValue={match.existingTip?.homeScore ?? ""}
            disabled={disabled}
            className={cn(scoreInputClass)}
            aria-label={`Skóre ${match.home.name}`}
          />
          <span className="text-slate-400">:</span>
          <input
            name={`away_${match.id}`}
            type="number"
            min={0}
            max={20}
            inputMode="numeric"
            defaultValue={match.existingTip?.awayScore ?? ""}
            disabled={disabled}
            className={cn(scoreInputClass)}
            aria-label={`Skóre ${match.away.name}`}
          />
        </div>

        {/* Away team */}
        <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
          <span className="text-xl leading-none">{match.away.flagEmoji}</span>
          <span>{match.away.name}</span>
        </div>
      </div>
    </li>
  );
}
