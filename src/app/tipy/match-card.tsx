"use client";

import { useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";

export interface MatchCardTeam {
  name: string;
  flagEmoji: string | null;
}

export interface MatchCardTip {
  userId: string;
  userName: string;
  homeScore: number;
  awayScore: number;
  points: number | null;
}

/** Skloňování: 1 tip, 2–4 tipy, 0 / 5+ tipů. */
function tipCountLabel(n: number): string {
  if (n === 1) return "tip";
  if (n >= 2 && n <= 4) return "tipy";
  return "tipů";
}

/**
 * Sbalitelná karta zápasu s tipy všech.
 *
 * Tipy se do DOM připojí až při rozbalení (lazy mount) — díky tomu je stránka
 * se 72 zápasy lehká a rozbalování/sbalování neškube. Mezi kliknutím a
 * vykreslením seznamu se na okamžik ukáže točící se kolečko.
 */
export function MatchCard({
  dateLabel,
  home,
  away,
  homeScore,
  awayScore,
  tips,
  currentUserId,
}: {
  dateLabel: string;
  home: MatchCardTeam;
  away: MatchCardTeam;
  homeScore: number | null;
  awayScore: number | null;
  tips: MatchCardTip[];
  currentUserId: string;
}) {
  const [open, setOpen] = useState(false);
  // `ready` = seznam tipů je připojený. Drží se zvlášť od `open`, aby mezi
  // kliknutím a vykreslením seznamu stihlo naskočit kolečko.
  const [ready, setReady] = useState(false);

  const hasResult = homeScore !== null && awayScore !== null;
  const sorted = [...tips].sort((a, b) => {
    if (a.points !== null && b.points !== null && a.points !== b.points) {
      return b.points - a.points;
    }
    return a.userName.localeCompare(b.userName, "cs-CZ");
  });

  function toggle() {
    if (open) {
      setOpen(false);
      setReady(false);
      return;
    }
    setOpen(true);
    // Necháme prohlížeč vykreslit kolečko, teprve pak připojíme seznam tipů.
    requestAnimationFrame(() => requestAnimationFrame(() => setReady(true)));
  }

  return (
    <div className="group overflow-hidden rounded-xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="w-full cursor-pointer px-4 py-3 text-left"
      >
        <p className="mb-2 text-[11px] uppercase tracking-wide text-slate-400">
          {dateLabel}
        </p>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3">
          <div className="flex flex-col items-center gap-1 text-center">
            <span className="text-2xl leading-none">{home.flagEmoji}</span>
            <span className="text-sm font-medium leading-tight text-black break-words">
              {home.name}
            </span>
          </div>
          <div className="flex flex-col items-center">
            {hasResult ? (
              <div className="rounded-lg bg-slate-900 px-3 py-1.5 text-base font-bold tabular-nums text-white">
                {homeScore} : {awayScore}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs text-slate-400">
                ještě nehrál
              </div>
            )}
          </div>
          <div className="flex flex-col items-center gap-1 text-center">
            <span className="text-2xl leading-none">{away.flagEmoji}</span>
            <span className="text-sm font-medium leading-tight text-black break-words">
              {away.name}
            </span>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-center gap-1.5 text-xs font-medium text-slate-500">
          {open ? (
            <span>Skrýt tipy</span>
          ) : (
            <span>
              Zobrazit tipy všech ({sorted.length} {tipCountLabel(sorted.length)})
            </span>
          )}
          <ChevronDown
            className={`size-4 shrink-0 transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      {open &&
        (!ready ? (
          <div className="flex items-center justify-center border-t border-slate-100 px-4 py-6 text-slate-400">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : sorted.length === 0 ? (
          <p className="border-t border-slate-100 px-4 py-3 text-center text-xs text-slate-400">
            Nikdo nepodal tip
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 border-t border-slate-100">
            {sorted.map((t) => {
              const isMe = t.userId === currentUserId;
              return (
                <li
                  key={t.userId}
                  className={`flex items-center justify-between gap-3 px-4 py-2 text-sm ${
                    isMe ? "bg-amber-50" : ""
                  }`}
                >
                  <span
                    className={`truncate ${
                      isMe ? "font-semibold text-slate-900" : "text-slate-700"
                    }`}
                  >
                    {t.userName}
                    {isMe && (
                      <span className="ml-1.5 text-xs text-amber-700">(ty)</span>
                    )}
                  </span>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium tabular-nums text-slate-700">
                      {t.homeScore} : {t.awayScore}
                    </span>
                    {t.points !== null && (
                      <span
                        className={`w-10 text-right text-xs font-semibold tabular-nums ${
                          t.points > 0 ? "text-emerald-700" : "text-slate-400"
                        }`}
                      >
                        {t.points} b
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ))}
    </div>
  );
}
