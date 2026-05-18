"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, Trophy } from "lucide-react";

import {
  saveSpecialResultsAction,
  type SaveSpecialResultsResult,
} from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const inputClass =
  "h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 outline-none transition-colors focus-visible:border-slate-900 focus-visible:ring-2 focus-visible:ring-slate-900/20";

interface TeamRef {
  code: string;
  name: string;
  flagEmoji: string | null;
  group: string;
}

export interface SpecialResultsData {
  teams: TeamRef[];
  existing: Record<string, string>;
}

export function SpecialResultsForm({ data }: { data: SpecialResultsData }) {
  const [values, setValues] = useState<Record<string, string>>(() => ({
    special_TOURNAMENT_WINNER: data.existing["TOURNAMENT_WINNER"] ?? "",
    special_TOP_SCORER_TOURNAMENT: data.existing["TOP_SCORER_TOURNAMENT"] ?? "",
  }));
  const [state, setState] = useState<SaveSpecialResultsResult | null>(null);
  const [pending, startTransition] = useTransition();

  function update(key: string, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const formData = new FormData();
    for (const [k, v] of Object.entries(values)) {
      formData.append(k, v);
    }
    startTransition(async () => {
      const result = await saveSpecialResultsAction(null, formData);
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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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
            placeholder="Jméno hráče"
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
                Uloženo {state.saved}
                {state.deleted > 0 && (
                  <span className="text-slate-500">
                    {" "}/ smazáno {state.deleted}
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
              "Uložit speciální výsledky"
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}
