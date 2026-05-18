"use client";

import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";

import {
  saveMatchResultsAction,
  type SaveMatchResultsResult,
} from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const matchDateFormatter = new Intl.DateTimeFormat("cs-CZ", {
  weekday: "short",
  day: "numeric",
  month: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const scoreInputClass =
  "h-10 w-12 rounded-lg border border-slate-300 bg-white px-1 text-center text-base font-medium text-slate-900 tabular-nums outline-none transition-colors focus-visible:border-slate-900 focus-visible:ring-2 focus-visible:ring-slate-900/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500";

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
  /// Aktuální zadané skóre (null = ještě nezadáno)
  homeScore: number | null;
  awayScore: number | null;
}

export interface SectionData {
  label: string;
  matches: MatchData[];
}

function initialScores(sections: SectionData[]): Record<string, string> {
  const init: Record<string, string> = {};
  for (const s of sections) {
    for (const m of s.matches) {
      init[`home_${m.id}`] = m.homeScore?.toString() ?? "";
      init[`away_${m.id}`] = m.awayScore?.toString() ?? "";
    }
  }
  return init;
}

export function MatchResultsForm({ sections }: { sections: SectionData[] }) {
  const [scores, setScores] = useState<Record<string, string>>(() =>
    initialScores(sections)
  );
  const [state, setState] = useState<SaveMatchResultsResult | null>(null);
  const [pending, startTransition] = useTransition();

  function update(key: string, value: string) {
    setScores((s) => ({ ...s, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const formData = new FormData();
    for (const [k, v] of Object.entries(scores)) {
      formData.append(k, v);
    }
    startTransition(async () => {
      const result = await saveMatchResultsAction(null, formData);
      setState(result);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {sections.map((s) => (
        <section
          key={s.label}
          className="overflow-hidden rounded-xl border border-slate-200 bg-white"
        >
          <header className="border-b border-slate-200 bg-slate-50 px-4 py-2.5">
            <h2 className="text-sm font-semibold tracking-wide text-slate-700">
              {s.label}
            </h2>
          </header>
          <ul className="divide-y divide-slate-100">
            {s.matches.map((m) => (
              <MatchRow
                key={m.id}
                match={m}
                scores={scores}
                onChange={update}
              />
            ))}
          </ul>
        </section>
      ))}

      <div className="sticky bottom-0 -mx-4 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm text-slate-600">
            {state?.status === "ok" && (
              <span className="inline-flex items-center gap-1.5 text-emerald-700">
                <Check className="size-4" />
                Aktualizováno {state.updated}
                {state.cleared > 0 && (
                  <span className="text-slate-500">
                    {" "}/ smazáno {state.cleared}
                  </span>
                )}
              </span>
            )}
            {state?.status === "forbidden" && (
              <span className="text-rose-700">Nemáš admin práva.</span>
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
            disabled={pending}
            className="h-10 rounded-lg bg-slate-900 px-5 text-sm font-medium text-white hover:bg-slate-800 disabled:bg-slate-300"
          >
            {pending ? (
              <>
                <Loader2 className="mr-1.5 size-4 animate-spin" />
                Ukládám…
              </>
            ) : (
              "Uložit výsledky"
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}

function MatchRow({
  match,
  scores,
  onChange,
}: {
  match: MatchData;
  scores: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  const date = new Date(match.dateIso);
  const homeKey = `home_${match.id}`;
  const awayKey = `away_${match.id}`;
  return (
    <li className="px-3 py-3 sm:px-4">
      <p className="mb-2 text-[11px] uppercase tracking-wide text-slate-400">
        {matchDateFormatter.format(date)}
      </p>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3">
        <div className="flex flex-col items-center gap-1 text-center">
          <span className="text-2xl leading-none">{match.home.flagEmoji}</span>
          <span className="text-sm font-medium leading-tight text-slate-900 break-words">
            {match.home.name}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <input
            name={homeKey}
            type="number"
            min={0}
            max={99}
            inputMode="numeric"
            value={scores[homeKey] ?? ""}
            onChange={(e) => onChange(homeKey, e.target.value)}
            className={cn(scoreInputClass)}
            aria-label={`Skóre ${match.home.name}`}
          />
          <span className="text-slate-400">:</span>
          <input
            name={awayKey}
            type="number"
            min={0}
            max={99}
            inputMode="numeric"
            value={scores[awayKey] ?? ""}
            onChange={(e) => onChange(awayKey, e.target.value)}
            className={cn(scoreInputClass)}
            aria-label={`Skóre ${match.away.name}`}
          />
        </div>

        <div className="flex flex-col items-center gap-1 text-center">
          <span className="text-2xl leading-none">{match.away.flagEmoji}</span>
          <span className="text-sm font-medium leading-tight text-slate-900 break-words">
            {match.away.name}
          </span>
        </div>
      </div>
    </li>
  );
}
