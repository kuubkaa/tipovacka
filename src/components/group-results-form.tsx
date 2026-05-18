"use client";

import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";

import {
  saveGroupResultsAction,
  type SaveGroupResultsResult,
} from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const inputClass =
  "h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm font-medium text-slate-900 outline-none transition-colors focus-visible:border-slate-900 focus-visible:ring-2 focus-visible:ring-slate-900/20";

interface TeamRef {
  code: string;
  name: string;
  flagEmoji: string | null;
}

export interface GroupResultData {
  group: string;
  teams: TeamRef[];
  existingRanking: string[] | null;
  existingScorer: string | null;
}

const POSITION_LABELS = ["1. místo", "2. místo", "3. místo", "4. místo"] as const;

function initialPicks(groups: GroupResultData[]): Record<string, string> {
  const init: Record<string, string> = {};
  for (const g of groups) {
    for (let i = 0; i < 4; i++) {
      init[`group_${g.group}_pos${i + 1}`] = g.existingRanking?.[i] ?? "";
    }
    init[`group_${g.group}_scorer`] = g.existingScorer ?? "";
  }
  return init;
}

export function GroupResultsForm({ groups }: { groups: GroupResultData[] }) {
  const [picks, setPicks] = useState<Record<string, string>>(() =>
    initialPicks(groups)
  );
  const [state, setState] = useState<SaveGroupResultsResult | null>(null);
  const [pending, startTransition] = useTransition();

  function update(key: string, value: string) {
    setPicks((p) => ({ ...p, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const formData = new FormData();
    for (const [k, v] of Object.entries(picks)) {
      formData.append(k, v);
    }
    startTransition(async () => {
      const result = await saveGroupResultsAction(null, formData);
      setState(result);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            <div className="space-y-2 p-4">
              {POSITION_LABELS.map((label, i) => {
                const name = `group_${g.group}_pos${i + 1}`;
                return (
                  <div
                    key={name}
                    className="grid grid-cols-[92px_1fr] items-center gap-3"
                  >
                    <label
                      htmlFor={name}
                      className="text-xs font-medium text-slate-500"
                    >
                      {label}
                    </label>
                    <select
                      id={name}
                      name={name}
                      value={picks[name] ?? ""}
                      onChange={(e) => update(name, e.target.value)}
                      className={cn(inputClass)}
                    >
                      <option value="">— vyber tým —</option>
                      {g.teams.map((t) => (
                        <option key={t.code} value={t.code}>
                          {t.flagEmoji ? `${t.flagEmoji} ` : ""}
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
              <div className="mt-3 grid grid-cols-[92px_1fr] items-center gap-3 border-t border-slate-100 pt-3">
                <label
                  htmlFor={`group_${g.group}_scorer`}
                  className="text-xs font-medium text-slate-500"
                >
                  Král střelců
                </label>
                <input
                  id={`group_${g.group}_scorer`}
                  type="text"
                  name={`group_${g.group}_scorer`}
                  value={picks[`group_${g.group}_scorer`] ?? ""}
                  onChange={(e) =>
                    update(`group_${g.group}_scorer`, e.target.value)
                  }
                  placeholder="Jméno hráče"
                  maxLength={80}
                  className={cn(inputClass)}
                />
              </div>
            </div>
          </section>
        ))}
      </div>

      <div className="sticky bottom-0 -mx-4 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm text-slate-600">
            {state?.status === "ok" && (
              <span className="inline-flex items-center gap-1.5 text-emerald-700">
                <Check className="size-4" />
                Uloženo {state.saved} skupin
                {state.scorersSaved > 0 && (
                  <span className="text-slate-500">
                    {" "}/ {state.scorersSaved} střelců
                  </span>
                )}
                {state.skipped.length > 0 && (
                  <span className="ml-2 text-amber-700">
                    (přeskočeno: {state.skipped.join(", ")})
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
