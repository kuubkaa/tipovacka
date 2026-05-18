"use client";

import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";

import {
  saveGroupRankingsAction,
  type SaveGroupRankingsResult,
} from "@/app/formular/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const selectClass =
  "h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm font-medium text-slate-900 outline-none transition-colors focus-visible:border-slate-900 focus-visible:ring-2 focus-visible:ring-slate-900/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500";

interface TeamRef {
  code: string;
  name: string;
  flagEmoji: string | null;
}

export interface GroupRankingData {
  group: string;
  teams: TeamRef[];
  /// Existující tip — ordered pole 4 team kódů od 1. do 4. místa
  existingRanking: string[] | null;
  /// Existující tip na krále střelců skupiny (jméno hráče, free text)
  existingScorer: string | null;
}

const POSITION_LABELS = ["1. místo", "2. místo", "3. místo", "4. místo"] as const;

/**
 * Sestaví flat klíč -> hodnota mapu pro pozice (1.–4.) + krále střelců.
 * Klíče: `group_<X>_pos<1-4>` a `group_<X>_scorer`.
 */
function initialPicks(groups: GroupRankingData[]): Record<string, string> {
  const init: Record<string, string> = {};
  for (const g of groups) {
    for (let i = 0; i < 4; i++) {
      const key = `group_${g.group}_pos${i + 1}`;
      init[key] = g.existingRanking?.[i] ?? "";
    }
    init[`group_${g.group}_scorer`] = g.existingScorer ?? "";
  }
  return init;
}

export function GroupRankingsForm({
  groups,
  disabled,
}: {
  groups: GroupRankingData[];
  disabled: boolean;
}) {
  // Controlled state. Voláme server action manuálně přes useTransition,
  // ne přes <form action={...}> + useActionState — to v React 19 dělá
  // restart client subtree (useState picks by se přemazal po každém save).
  const [picks, setPicks] = useState<Record<string, string>>(() =>
    initialPicks(groups)
  );
  const [state, setState] = useState<SaveGroupRankingsResult | null>(null);
  const [pending, startTransition] = useTransition();

  function update(key: string, value: string) {
    setPicks((p) => ({ ...p, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (disabled || pending) return;
    const formData = new FormData();
    for (const [k, v] of Object.entries(picks)) {
      formData.append(k, v);
    }
    startTransition(async () => {
      const result = await saveGroupRankingsAction(null, formData);
      setState(result);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {groups.map((g) => (
          <GroupCard
            key={g.group}
            group={g}
            disabled={disabled}
            picks={picks}
            onPick={update}
          />
        ))}
      </div>

      <div className="sticky bottom-0 -mx-4 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm text-slate-600">
            {state?.status === "ok" && (
              <span className="inline-flex items-center gap-1.5 text-emerald-700">
                <Check className="size-4" />
                Uloženo {state.saved} pořadí
                {state.skipped.length > 0 && (
                  <span className="ml-2 text-amber-700">
                    (přeskočeno: {state.skipped.join(", ")} — vyplň všechny 4
                    pozice unikátně)
                  </span>
                )}
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
              "Uložit pořadí"
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}

function GroupCard({
  group,
  disabled,
  picks,
  onPick,
}: {
  group: GroupRankingData;
  disabled: boolean;
  picks: Record<string, string>;
  onPick: (key: string, value: string) => void;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <header className="border-b border-slate-200 bg-slate-50 px-4 py-2.5">
        <h2 className="text-sm font-semibold tracking-wide text-slate-700">
          Skupina {group.group}
        </h2>
      </header>
      <div className="space-y-2 p-4">
        {POSITION_LABELS.map((label, i) => {
          const fieldName = `group_${group.group}_pos${i + 1}`;
          return (
            <div
              key={fieldName}
              className="grid grid-cols-[92px_1fr] items-center gap-3"
            >
              <label
                htmlFor={fieldName}
                className="text-xs font-medium text-slate-500"
              >
                {label}
              </label>
              <select
                id={fieldName}
                name={fieldName}
                value={picks[fieldName] ?? ""}
                onChange={(e) => onPick(fieldName, e.target.value)}
                disabled={disabled}
                className={cn(selectClass)}
              >
                <option value="">— vyber tým —</option>
                {group.teams.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.flagEmoji ? `${t.flagEmoji} ` : ""}
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          );
        })}

        {/* Král střelců skupiny */}
        <div className="mt-3 grid grid-cols-[80px_1fr] items-center gap-3 border-t border-slate-100 pt-3">
          <label
            htmlFor={`group_${group.group}_scorer`}
            className="text-xs font-medium text-slate-500"
          >
            Král střelců
          </label>
          <input
            id={`group_${group.group}_scorer`}
            type="text"
            name={`group_${group.group}_scorer`}
            value={picks[`group_${group.group}_scorer`] ?? ""}
            onChange={(e) =>
              onPick(`group_${group.group}_scorer`, e.target.value)
            }
            disabled={disabled}
            placeholder="Jméno hráče"
            maxLength={80}
            className={cn(selectClass)}
          />
        </div>
      </div>
    </section>
  );
}
