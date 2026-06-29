"use client";

import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";

import {
  saveKnockoutResultsAction,
  type SaveKnockoutResultsResult,
} from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { KNOCKOUT_ADVANCERS_ROUNDS } from "@/lib/knockout-rounds";

interface TeamRef {
  code: string;
  name: string;
  flagEmoji: string | null;
  group: string;
}

// Z jakého kola se berou týmy do nabídky daného kola. R32 = všechny týmy
// (skupinová fáze); každé další kolo nabízí jen ty, co postoupily v kole
// předchozím. „O 3. místo" i finále čerpají ze čtyř semifinalistů.
const PREV_ROUND_KEY: Record<string, string | null> = {
  R32: null,
  R16: "R32",
  QF: "R16",
  SF: "QF",
  BRONZ: "SF",
  F: "SF",
};

// Kola, která (tranzitivně) závisí na daném kole — pro úklid při odznačení.
function descendantsOf(key: string): string[] {
  const isAncestor = (target: string, of: string): boolean => {
    let c = PREV_ROUND_KEY[of];
    while (c) {
      if (c === target) return true;
      c = PREV_ROUND_KEY[c];
    }
    return false;
  };
  return Object.keys(PREV_ROUND_KEY).filter((k) => isAncestor(key, k));
}

export interface KnockoutResultsData {
  teams: TeamRef[];
  existing: Record<string, string[]>;
}

function initialAdvancers(
  data: KnockoutResultsData
): Record<string, Set<string>> {
  const init: Record<string, Set<string>> = {};
  for (const round of KNOCKOUT_ADVANCERS_ROUNDS) {
    init[round.key] = new Set(data.existing[round.key] ?? []);
  }
  return init;
}

export function KnockoutResultsForm({ data }: { data: KnockoutResultsData }) {
  const [advancers, setAdvancers] = useState<Record<string, Set<string>>>(() =>
    initialAdvancers(data)
  );
  const [state, setState] = useState<SaveKnockoutResultsResult | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(roundKey: string, code: string, max: number) {
    setAdvancers((prev) => {
      const set = new Set(prev[roundKey] ?? []);
      if (set.has(code)) {
        set.delete(code);
        // Tým vypadl z tohoto kola → vyřaď ho i ze všech navazujících kol,
        // ať tam nezůstane "duch" (vybraný, ale už nezobrazitelný).
        const next: Record<string, Set<string>> = { ...prev, [roundKey]: set };
        for (const desc of descendantsOf(roundKey)) {
          const ds = new Set(next[desc] ?? []);
          if (ds.delete(code)) next[desc] = ds;
        }
        return next;
      }
      if (set.size >= max) return prev;
      set.add(code);
      return { ...prev, [roundKey]: set };
    });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const formData = new FormData();
    for (const round of KNOCKOUT_ADVANCERS_ROUNDS) {
      const set = advancers[round.key] ?? new Set();
      for (const code of set) {
        formData.append(`advancers_${round.key}`, code);
      }
    }
    startTransition(async () => {
      const result = await saveKnockoutResultsAction(null, formData);
      setState(result);
    });
  }

  const teamsByGroup = new Map<string, TeamRef[]>();
  for (const t of data.teams) {
    const list = teamsByGroup.get(t.group) ?? [];
    list.push(t);
    teamsByGroup.set(t.group, list);
  }
  const orderedGroups = Array.from(teamsByGroup.entries()).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  // Vyhodnocená kola (kompletně zadaná v DB) přesuň na konec, zbytek
  // ponech v přirozeném pořadí. Vychází z uložených dat (ne z live editace),
  // aby se pořadí během vyplňování nepřeskupovalo.
  const roundIsDone = (key: string, target: number) =>
    target > 0 && (data.existing[key]?.length ?? 0) === target;
  const orderedRounds = [...KNOCKOUT_ADVANCERS_ROUNDS].sort((a, b) => {
    const ad = roundIsDone(a.key, a.targetCount) ? 1 : 0;
    const bd = roundIsDone(b.key, b.targetCount) ? 1 : 0;
    return ad - bd;
  });

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {orderedRounds.map((round) => {
        const selectedSet = advancers[round.key] ?? new Set<string>();
        // Týmy k nabídnutí: R32 = všechny; další kola jen postupující
        // z předchozího kola (živě podle aktuálního výběru).
        const prevKey = PREV_ROUND_KEY[round.key];
        const available = prevKey ? advancers[prevKey] ?? new Set<string>() : null;
        const groupsForRound = available
          ? orderedGroups
              .map(
                ([g, ts]) =>
                  [g, ts.filter((t) => available.has(t.code))] as [
                    string,
                    TeamRef[],
                  ]
              )
              .filter(([, ts]) => ts.length > 0)
          : orderedGroups;
        return (
          <section
            key={round.key}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white"
          >
            <header className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
              <h2 className="text-sm font-semibold tracking-wide text-slate-700">
                {round.label}
              </h2>
              <span
                className={cn(
                  "text-xs font-medium tabular-nums",
                  selectedSet.size === round.targetCount
                    ? "text-emerald-700"
                    : "text-slate-500"
                )}
              >
                {selectedSet.size} / {round.targetCount}
              </span>
            </header>
            <div className="space-y-3 p-4">
              {groupsForRound.length === 0 && (
                <p className="text-xs text-slate-500">
                  Nejdřív označ postupující v předchozím kole.
                </p>
              )}
              {groupsForRound.map(([group, ts]) => (
                <div key={group}>
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
                    Skupina {group}
                  </p>
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
                    {ts.map((t) => {
                      const selected = selectedSet.has(t.code);
                      const atMax =
                        !selected && selectedSet.size >= round.targetCount;
                      return (
                        <label
                          key={t.code}
                          title={
                            atMax
                              ? `Maximum ${round.targetCount} dosaženo`
                              : t.name
                          }
                          className={cn(
                            "flex min-h-9 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                            selected
                              ? "cursor-pointer border-slate-900 bg-slate-900 text-white"
                              : atMax
                                ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 opacity-60"
                                : "cursor-pointer border-slate-200 bg-white text-black hover:border-slate-400 active:bg-slate-100"
                          )}
                        >
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={selected}
                            disabled={atMax}
                            onChange={() =>
                              toggle(round.key, t.code, round.targetCount)
                            }
                          />
                          <span className="text-sm leading-none">
                            {t.flagEmoji}
                          </span>
                          <span className="truncate">{t.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      <div className="sticky bottom-0 -mx-4 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm text-slate-600">
            {state?.status === "ok" && (
              <span className="inline-flex items-center gap-1.5 text-emerald-700">
                <Check className="size-4" />
                Uloženo {state.saved} kol
                {state.cleared > 0 && (
                  <span className="text-slate-500">
                    {" "}/ {state.cleared} smazáno
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
              "Uložit postupující"
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}
