"use client";

import { useActionState } from "react";
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
}

const POSITION_LABELS = ["1. místo", "2. místo", "3. místo", "4. místo"] as const;

export function GroupRankingsForm({
  groups,
  disabled,
}: {
  groups: GroupRankingData[];
  disabled: boolean;
}) {
  const [state, formAction, pending] = useActionState<
    SaveGroupRankingsResult | null,
    FormData
  >(saveGroupRankingsAction, null);

  return (
    <form action={formAction} className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {groups.map((g) => (
          <GroupCard key={g.group} group={g} disabled={disabled} />
        ))}
      </div>

      <div className="sticky bottom-0 -mx-6 border-t border-slate-200 bg-white/95 px-6 py-3 backdrop-blur">
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
}: {
  group: GroupRankingData;
  disabled: boolean;
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
          const defaultCode = group.existingRanking?.[i] ?? "";
          return (
            <div
              key={fieldName}
              className="grid grid-cols-[80px_1fr] items-center gap-3"
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
                defaultValue={defaultCode}
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
      </div>
    </section>
  );
}
