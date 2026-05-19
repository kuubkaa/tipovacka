"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";

import {
  saveScorerAliasesAction,
  type SaveScorerAliasesResult,
} from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ScorerTipVariant {
  /** Reprezentativní pravopis pro zobrazení a uložení do aliasů. */
  display: string;
  /** Normalizovaná forma (klíč pro skupinování). */
  normalized: string;
  /** Kolik tipérů zadalo variantu, která se po normalizaci shoduje. */
  count: number;
  /** True, pokud normalizovaná forma odpovídá skutečné hodnotě (počítá se automaticky). */
  isAutoMatch: boolean;
  /** True, pokud je `display` aktuálně v acceptedAliases. */
  isCurrentlyAccepted: boolean;
}

export interface ScorerSection {
  type: string;
  label: string;
  realValue: string;
  variants: ScorerTipVariant[];
}

export interface ScorerAliasesData {
  sections: ScorerSection[];
}

function initialSelection(
  sections: ScorerSection[]
): Record<string, Set<string>> {
  const init: Record<string, Set<string>> = {};
  for (const s of sections) {
    const set = new Set<string>();
    for (const v of s.variants) {
      if (v.isCurrentlyAccepted && !v.isAutoMatch) set.add(v.normalized);
    }
    init[s.type] = set;
  }
  return init;
}

export function ScorerAliasesForm({ data }: { data: ScorerAliasesData }) {
  const [selection, setSelection] = useState<Record<string, Set<string>>>(
    () => initialSelection(data.sections)
  );
  const [state, setState] = useState<SaveScorerAliasesResult | null>(null);
  const [pending, startTransition] = useTransition();

  const displayByKey = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of data.sections) {
      for (const v of s.variants) {
        m.set(`${s.type}::${v.normalized}`, v.display);
      }
    }
    return m;
  }, [data]);

  function toggle(type: string, normalized: string) {
    setSelection((prev) => {
      const set = new Set(prev[type] ?? []);
      if (set.has(normalized)) set.delete(normalized);
      else set.add(normalized);
      return { ...prev, [type]: set };
    });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const formData = new FormData();
    for (const s of data.sections) {
      const set = selection[s.type] ?? new Set<string>();
      for (const normalized of set) {
        const display = displayByKey.get(`${s.type}::${normalized}`);
        if (display) formData.append(`alias_${s.type}`, display);
      }
    }
    startTransition(async () => {
      const result = await saveScorerAliasesAction(null, formData);
      setState(result);
    });
  }

  if (data.sections.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        Zatím nejsou zadané žádné skutečné krále střelců. Zadej je nejprve v
        sekcích <em>Pořadí skupin</em> a <em>Speciální výsledky</em>.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {data.sections.map((s) => {
        const selected = selection[s.type] ?? new Set<string>();
        const manualVariants = s.variants.filter((v) => !v.isAutoMatch);
        const autoVariants = s.variants.filter((v) => v.isAutoMatch);
        const autoCount = autoVariants.reduce((a, v) => a + v.count, 0);
        return (
          <section
            key={s.type}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white"
          >
            <header className="border-b border-slate-200 bg-slate-50 px-4 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold tracking-wide text-slate-700">
                  {s.label}
                </h2>
                <span className="text-xs text-slate-500">
                  Skutečnost:{" "}
                  <span className="font-semibold text-slate-900">
                    {s.realValue}
                  </span>
                </span>
              </div>
            </header>
            <div className="p-4">
              {s.variants.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Zatím žádné tipy.
                </p>
              ) : (
                <div className="space-y-2">
                  {autoCount > 0 && (
                    <p className="text-xs text-emerald-700">
                      ✓ Automaticky uznáno {autoCount}{" "}
                      {autoCount === 1
                        ? "tip"
                        : autoCount < 5
                          ? "tipy"
                          : "tipů"}{" "}
                      (shoda po normalizaci diakritiky/velikosti písmen).
                    </p>
                  )}
                  {manualVariants.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      Žádné další varianty k posouzení.
                    </p>
                  ) : (
                    <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                      {manualVariants.map((v) => {
                        const isOn = selected.has(v.normalized);
                        return (
                          <li key={v.normalized}>
                            <label
                              className={cn(
                                "flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-slate-50",
                                isOn && "bg-emerald-50 hover:bg-emerald-50"
                              )}
                            >
                              <input
                                type="checkbox"
                                className="size-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                checked={isOn}
                                onChange={() => toggle(s.type, v.normalized)}
                              />
                              <span className="flex-1 truncate text-sm font-medium text-slate-900">
                                {v.display}
                              </span>
                              <span className="shrink-0 text-xs text-slate-500">
                                {v.count}×
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
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
                Uloženo ({state.saved} typů)
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
              "Uložit sjednocení"
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}
