"use client";

import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";

import {
  saveKnockoutFixturesAction,
  type SaveKnockoutFixturesResult,
} from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const inputClass =
  "h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm font-medium text-slate-900 outline-none transition-colors focus-visible:border-slate-900 focus-visible:ring-2 focus-visible:ring-slate-900/20";

interface TeamRef {
  code: string;
  name: string;
  flagEmoji: string | null;
  group: string;
}

export interface ExistingFixture {
  matchKey: string;
  homeCode: string;
  awayCode: string;
  /// ISO bez timezone, pro datetime-local input. Např. "2026-06-29T21:00"
  dateLocal: string;
}

export interface KnockoutFixturesData {
  teams: TeamRef[];
  existing: ExistingFixture[];
}

const ROUNDS = [
  { prefix: "R32", label: "Šestnáctifinále", count: 16 },
  { prefix: "R16", label: "Osmifinále", count: 8 },
  { prefix: "QF", label: "Čtvrtfinále", count: 4 },
  { prefix: "SF", label: "Semifinále", count: 2 },
  { prefix: "BRONZ", label: "O 3. místo", count: 1 },
  { prefix: "F", label: "Finále", count: 1 },
] as const;

function makeKey(prefix: string, idx: number) {
  return `${prefix}-${idx}`;
}

function initialValues(
  data: KnockoutFixturesData
): Record<string, string> {
  const init: Record<string, string> = {};
  for (const round of ROUNDS) {
    for (let i = 1; i <= round.count; i++) {
      const key = makeKey(round.prefix, i);
      init[`match_${key}_home`] = "";
      init[`match_${key}_away`] = "";
      init[`match_${key}_date`] = "";
    }
  }
  for (const e of data.existing) {
    init[`match_${e.matchKey}_home`] = e.homeCode;
    init[`match_${e.matchKey}_away`] = e.awayCode;
    init[`match_${e.matchKey}_date`] = e.dateLocal;
  }
  return init;
}

export function KnockoutFixturesForm({
  data,
}: {
  data: KnockoutFixturesData;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    initialValues(data)
  );
  const [state, setState] = useState<SaveKnockoutFixturesResult | null>(null);
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
      const result = await saveKnockoutFixturesAction(null, formData);
      setState(result);
    });
  }

  // Seskupit týmy po skupinách pro select optgroup
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
      {ROUNDS.map((round) => (
        <section
          key={round.prefix}
          className="overflow-hidden rounded-xl border border-slate-200 bg-white"
        >
          <header className="border-b border-slate-200 bg-slate-50 px-4 py-2.5">
            <h2 className="text-sm font-semibold tracking-wide text-slate-700">
              {round.label}{" "}
              <span className="text-xs font-normal text-slate-500">
                ({round.count} {round.count === 1 ? "zápas" : round.count < 5 ? "zápasy" : "zápasů"})
              </span>
            </h2>
          </header>
          <div className="divide-y divide-slate-100">
            {Array.from({ length: round.count }, (_, idx) => {
              const i = idx + 1;
              const key = makeKey(round.prefix, i);
              return (
                <div key={key} className="p-4">
                  <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                    Zápas {key}
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_180px]">
                    <select
                      name={`match_${key}_home`}
                      value={values[`match_${key}_home`] ?? ""}
                      onChange={(e) =>
                        update(`match_${key}_home`, e.target.value)
                      }
                      className={cn(inputClass)}
                      aria-label="Domácí tým"
                    >
                      <option value="">— domácí —</option>
                      {orderedGroups.map(([g, ts]) => (
                        <optgroup key={g} label={`Skupina ${g}`}>
                          {ts.map((t) => (
                            <option key={t.code} value={t.code}>
                              {t.flagEmoji ? `${t.flagEmoji} ` : ""}
                              {t.name}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    <select
                      name={`match_${key}_away`}
                      value={values[`match_${key}_away`] ?? ""}
                      onChange={(e) =>
                        update(`match_${key}_away`, e.target.value)
                      }
                      className={cn(inputClass)}
                      aria-label="Hostující tým"
                    >
                      <option value="">— hosté —</option>
                      {orderedGroups.map(([g, ts]) => (
                        <optgroup key={g} label={`Skupina ${g}`}>
                          {ts.map((t) => (
                            <option key={t.code} value={t.code}>
                              {t.flagEmoji ? `${t.flagEmoji} ` : ""}
                              {t.name}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    <input
                      type="datetime-local"
                      name={`match_${key}_date`}
                      value={values[`match_${key}_date`] ?? ""}
                      onChange={(e) =>
                        update(`match_${key}_date`, e.target.value)
                      }
                      className={cn(inputClass)}
                      aria-label="Datum a čas výkopu"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <div className="sticky bottom-0 -mx-4 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm text-slate-600">
            {state?.status === "ok" && (
              <span className="inline-flex items-center gap-1.5 text-emerald-700">
                <Check className="size-4" />
                Uloženo {state.saved} zápasů
                {state.skipped > 0 && (
                  <span className="ml-2 text-amber-700">
                    (přeskočeno {state.skipped} — chybí pole nebo neplatný tým)
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
              "Uložit pavouka"
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}
