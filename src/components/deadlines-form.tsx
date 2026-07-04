"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Loader2, RotateCcw } from "lucide-react";

import {
  setDeadlineOverrideAction,
  type SetDeadlineOverrideResult,
} from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Jedna „uzavíratelná" jednotka — kolo, zápas, pořadí skupin nebo speciály. */
export interface DeadlineUnit {
  scope: string;
  label: string;
  /** Kontextový podtitulek (např. výkop zápasu). */
  sub?: string;
  /** Automatická uzávěrka jako datetime-local (pražský čas) — pro předvyplnění. */
  autoLocal: string;
  /** Automatická uzávěrka lidsky. */
  autoText: string;
  /** Ruční přebití jako datetime-local, nebo null když není. */
  overrideLocal: string | null;
  /** Aktuálně platná (efektivní) uzávěrka lidsky. */
  effectiveText: string;
  hasOverride: boolean;
  /** Jednotlivé zápasy pod touto jednotkou (schované pod rozklikem). */
  matches?: DeadlineUnit[];
}

export interface DeadlineSection {
  title: string;
  /** Jednotky na úrovni kola / kategorie (vždy viditelné). */
  units: DeadlineUnit[];
}

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none transition-colors focus-visible:border-slate-900 focus-visible:ring-2 focus-visible:ring-slate-900/20";

export function DeadlinesForm({ sections }: { sections: DeadlineSection[] }) {
  return (
    <div className="space-y-8">
      {sections.map((section) => (
        <section key={section.title}>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
            {section.title}
          </h2>
          <div className="space-y-3">
            {section.units.map((u) => (
              <div key={u.scope} className="space-y-3">
                <DeadlineRow unit={u} />
                {u.matches && u.matches.length > 0 && (
                  <details className="group overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
                      <span>
                        Jednotlivé zápasy{" "}
                        <span className="text-slate-400">({u.matches.length})</span>
                      </span>
                      <ChevronDown className="size-4 text-slate-400 transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="space-y-3 border-t border-slate-100 p-3">
                      {u.matches.map((m) => (
                        <DeadlineRow key={m.scope} unit={m} compact />
                      ))}
                    </div>
                  </details>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function DeadlineRow({
  unit,
  compact = false,
}: {
  unit: DeadlineUnit;
  compact?: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(unit.overrideLocal ?? unit.autoLocal);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  function run(op: "set" | "now" | "clear") {
    if (pending) return;
    setError(null);
    const fd = new FormData();
    fd.set("scope", unit.scope);
    fd.set("op", op);
    if (op === "set") fd.set("value", value);
    startTransition(async () => {
      const res: SetDeadlineOverrideResult = await setDeadlineOverrideAction(
        null,
        fd
      );
      if (res.status === "ok") {
        setJustSaved(true);
        setTimeout(() => setJustSaved(false), 2000);
        router.refresh();
      } else {
        setError(
          res.status === "bad-value"
            ? "Zadej platné datum a čas."
            : res.status === "forbidden" || res.status === "unauth"
              ? "Nemáš oprávnění."
              : "Něco se pokazilo. Zkus to znovu."
        );
      }
    });
  }

  return (
    <div
      className={cn(
        "rounded-xl border bg-white p-4",
        unit.hasOverride ? "border-amber-300" : "border-slate-200"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={cn("font-medium text-slate-900", compact ? "text-sm" : "text-base")}>
            {unit.label}
          </p>
          {unit.sub && (
            <p className="text-[11px] uppercase tracking-wide text-slate-400">
              {unit.sub}
            </p>
          )}
        </div>
        {unit.hasOverride ? (
          <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800">
            Ručně
          </span>
        ) : (
          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Automaticky
          </span>
        )}
      </div>

      <p className="mt-1 text-xs text-slate-500">
        Platí: <strong className="text-slate-700">{unit.effectiveText}</strong>
        {unit.hasOverride && (
          <span className="text-slate-400"> · automaticky: {unit.autoText}</span>
        )}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="datetime-local"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className={cn(inputClass, "w-auto min-w-[15rem] flex-1")}
        />
        <Button
          type="button"
          onClick={() => run("set")}
          disabled={pending}
          className="h-9 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:bg-slate-300"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : justSaved ? (
            <Check className="size-4" />
          ) : (
            "Uložit"
          )}
        </Button>
        <button
          type="button"
          onClick={() => run("now")}
          disabled={pending}
          className="h-9 rounded-lg border border-rose-200 bg-rose-50 px-3 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-50"
        >
          Zavřít teď
        </button>
        {unit.hasOverride && (
          <button
            type="button"
            onClick={() => run("clear")}
            disabled={pending}
            aria-label="Zrušit ruční uzávěrku (zpět na automatiku)"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 transition-colors hover:border-slate-400 hover:text-slate-900 disabled:opacity-50"
          >
            <RotateCcw className="size-3.5" /> Automaticky
          </button>
        )}
      </div>

      <p className="mt-2 text-[11px] text-slate-400">
        Čas je v pražské zóně. „Uložit“ nastaví ruční uzávěrku, „Zavřít teď“
        uzamkne okamžitě, „Automaticky“ ruční nastavení zruší.
      </p>

      {error && <p className="mt-2 text-sm text-rose-700">{error}</p>}
    </div>
  );
}
