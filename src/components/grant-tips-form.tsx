"use client";

import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";

import {
  saveGrantTipsAction,
  type SaveGrantTipsResult,
} from "@/app/dotipovani/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Stejný styl skóre inputu jako v TipsForm (shadcn Input nepředává `name`).
const scoreInputClass =
  "h-10 w-12 rounded-lg border border-slate-300 bg-white px-1 text-center text-base font-medium text-slate-900 tabular-nums outline-none transition-colors focus-visible:border-slate-900 focus-visible:ring-2 focus-visible:ring-slate-900/20";

const matchDateFormatter = new Intl.DateTimeFormat("cs-CZ", {
  weekday: "short",
  day: "numeric",
  month: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Prague",
});

interface TeamRef {
  code: string;
  name: string;
  flagEmoji: string | null;
}

export interface GrantMatchData {
  id: string;
  dateIso: string;
  home: TeamRef;
  away: TeamRef;
  existingTip: { homeScore: number; awayScore: number } | null;
}

export interface GrantSectionData {
  label: string;
  matches: GrantMatchData[];
}

function initialScores(sections: GrantSectionData[]): Record<string, string> {
  const init: Record<string, string> = {};
  for (const s of sections) {
    for (const m of s.matches) {
      init[`home_${m.id}`] = m.existingTip?.homeScore?.toString() ?? "";
      init[`away_${m.id}`] = m.existingTip?.awayScore?.toString() ?? "";
    }
  }
  return init;
}

export function GrantTipsForm({
  token,
  sections,
}: {
  token: string;
  sections: GrantSectionData[];
}) {
  const [scores, setScores] = useState<Record<string, string>>(() =>
    initialScores(sections)
  );
  const [state, setState] = useState<SaveGrantTipsResult | null>(null);
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
      const result = await saveGrantTipsAction(token, formData);
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
                <Check className="size-4" /> Uloženo {state.saved}{" "}
                {state.saved === 1
                  ? "tip"
                  : state.saved < 5
                    ? "tipy"
                    : "tipů"}
              </span>
            )}
            {state?.status === "expired" && (
              <span className="text-rose-700">
                Odkaz vypršel — ozvi se adminovi.
              </span>
            )}
            {state?.status === "invalid" && (
              <span className="text-rose-700">
                Odkaz už neplatí — ozvi se adminovi.
              </span>
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
  scores,
  onChange,
}: {
  match: GrantMatchData;
  scores: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  const date = new Date(match.dateIso);
  const homeKey = `home_${match.id}`;
  const awayKey = `away_${match.id}`;
  return (
    <li className="px-3 py-3 sm:px-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-wide text-slate-400">
          {matchDateFormatter.format(date)}
        </p>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3">
        <div className="flex flex-col items-center gap-1 text-center">
          <span className="text-2xl leading-none">{match.home.flagEmoji}</span>
          <span className="text-sm font-medium leading-tight text-black break-words">
            {match.home.name}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <input
            name={homeKey}
            type="number"
            min={0}
            max={20}
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
            max={20}
            inputMode="numeric"
            value={scores[awayKey] ?? ""}
            onChange={(e) => onChange(awayKey, e.target.value)}
            className={cn(scoreInputClass)}
            aria-label={`Skóre ${match.away.name}`}
          />
        </div>
        <div className="flex flex-col items-center gap-1 text-center">
          <span className="text-2xl leading-none">{match.away.flagEmoji}</span>
          <span className="text-sm font-medium leading-tight text-black break-words">
            {match.away.name}
          </span>
        </div>
      </div>
    </li>
  );
}
