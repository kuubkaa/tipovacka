"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, Trophy } from "lucide-react";

import {
  saveSpecialTipsAction,
  type SaveSpecialTipsResult,
} from "@/app/formular/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { KNOCKOUT_ADVANCERS_ROUNDS } from "@/lib/knockout-rounds";

const inputClass =
  "h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 outline-none transition-colors focus-visible:border-slate-900 focus-visible:ring-2 focus-visible:ring-slate-900/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500";

interface TeamRef {
  code: string;
  name: string;
  flagEmoji: string | null;
  group: string;
}

export interface SpecialTipsData {
  teams: TeamRef[];
  /// Existující speciální tipy (winner + scorers): type → value
  existing: Record<string, string>;
  /// Existující postupující: round key (R32/R16/QF/SF/F) → seznam team kódů
  existingAdvancers: Record<string, string[]>;
}

function initialValues(data: SpecialTipsData): Record<string, string> {
  return {
    special_TOURNAMENT_WINNER: data.existing["TOURNAMENT_WINNER"] ?? "",
    special_TOP_SCORER_TOURNAMENT: data.existing["TOP_SCORER_TOURNAMENT"] ?? "",
  };
}

function initialAdvancers(
  data: SpecialTipsData
): Record<string, Set<string>> {
  const init: Record<string, Set<string>> = {};
  for (const round of KNOCKOUT_ADVANCERS_ROUNDS) {
    init[round.key] = new Set(data.existingAdvancers[round.key] ?? []);
  }
  return init;
}

export function SpecialTipsForm({
  data,
  disabled,
}: {
  data: SpecialTipsData;
  disabled: boolean;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    initialValues(data)
  );
  const [advancers, setAdvancers] = useState<Record<string, Set<string>>>(
    () => initialAdvancers(data)
  );
  const [state, setState] = useState<SaveSpecialTipsResult | null>(null);
  const [pending, startTransition] = useTransition();

  function update(key: string, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function toggleAdvancer(roundKey: string, code: string, max: number) {
    setAdvancers((prev) => {
      const set = new Set(prev[roundKey] ?? []);
      if (set.has(code)) {
        set.delete(code);
      } else {
        if (set.size >= max) return prev;
        set.add(code);
      }
      return { ...prev, [roundKey]: set };
    });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (disabled || pending) return;
    const formData = new FormData();
    for (const [k, v] of Object.entries(values)) {
      formData.append(k, v);
    }
    for (const round of KNOCKOUT_ADVANCERS_ROUNDS) {
      const set = advancers[round.key] ?? new Set();
      for (const code of set) {
        formData.append(`advancers_${round.key}`, code);
      }
    }
    startTransition(async () => {
      const result = await saveSpecialTipsAction(null, formData);
      setState(result);
    });
  }

  // Seskupit týmy po skupinách
  const teamsByGroup = new Map<string, TeamRef[]>();
  for (const t of data.teams) {
    const list = teamsByGroup.get(t.group) ?? [];
    list.push(t);
    teamsByGroup.set(t.group, list);
  }
  const orderedGroups = Array.from(teamsByGroup.entries()).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Postupující do vyřazovacích kol */}
      {KNOCKOUT_ADVANCERS_ROUNDS.map((round) => {
        const selectedSet = advancers[round.key] ?? new Set<string>();
        const selectedCount = selectedSet.size;
        return (
          <section
            key={round.key}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white"
          >
            <header className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
              <h2 className="text-sm font-semibold tracking-wide text-slate-700">
                Postupující do {round.label}
              </h2>
              <span
                className={cn(
                  "text-xs font-medium tabular-nums",
                  selectedCount === round.targetCount
                    ? "text-emerald-700"
                    : "text-slate-500"
                )}
              >
                Vybráno: {selectedCount} / {round.targetCount}
              </span>
            </header>
            <div className="space-y-3 p-4">
              {orderedGroups.map(([group, ts]) => (
                <div key={group}>
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
                    Skupina {group}
                  </p>
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
                    {ts.map((t) => {
                      const selected = selectedSet.has(t.code);
                      const atMax =
                        !selected && selectedSet.size >= round.targetCount;
                      const blocked = disabled || atMax;
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
                              : blocked
                                ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 opacity-60"
                                : "cursor-pointer border-slate-200 bg-white text-slate-700 hover:border-slate-400 active:bg-slate-100"
                          )}
                        >
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={selected}
                            disabled={blocked}
                            onChange={() =>
                              toggleAdvancer(round.key, t.code, round.targetCount)
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

      {/* Vítěz turnaje */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <header className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
          <Trophy className="size-4 text-amber-600" />
          <h2 className="text-sm font-semibold tracking-wide text-slate-700">
            Vítěz turnaje
          </h2>
        </header>
        <div className="p-4">
          <select
            name="special_TOURNAMENT_WINNER"
            value={values.special_TOURNAMENT_WINNER ?? ""}
            onChange={(e) =>
              update("special_TOURNAMENT_WINNER", e.target.value)
            }
            disabled={disabled}
            className={cn(inputClass)}
          >
            <option value="">— vyber tým —</option>
            {orderedGroups.map(([group, ts]) => (
              <optgroup key={group} label={`Skupina ${group}`}>
                {ts.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.flagEmoji ? `${t.flagEmoji} ` : ""}
                    {t.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      </section>

      {/* Král střelců turnaje */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <header className="border-b border-slate-200 bg-slate-50 px-4 py-2.5">
          <h2 className="text-sm font-semibold tracking-wide text-slate-700">
            Král střelců turnaje
          </h2>
        </header>
        <div className="p-4">
          <input
            type="text"
            name="special_TOP_SCORER_TOURNAMENT"
            value={values.special_TOP_SCORER_TOURNAMENT ?? ""}
            onChange={(e) =>
              update("special_TOP_SCORER_TOURNAMENT", e.target.value)
            }
            disabled={disabled}
            placeholder="Jméno hráče (např. Erling Haaland)"
            maxLength={80}
            className={cn(inputClass)}
          />
        </div>
      </section>

      <div className="sticky bottom-0 -mx-4 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm text-slate-600">
            {state?.status === "ok" && (
              <span className="inline-flex items-center gap-1.5 text-emerald-700">
                <Check className="size-4" />
                Uloženo {state.saved + state.advancersSaved}
              </span>
            )}
            {state?.status === "deadline" && (
              <span className="text-rose-700">
                Deadline uplynul, nejde uložit.
              </span>
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
              "Uzamčené"
            ) : (
              "Uložit speciální tipy"
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}
