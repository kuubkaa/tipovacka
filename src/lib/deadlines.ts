/**
 * Uzávěrky tipů — jedno místo pravdy.
 *
 * Uzávěrka se skládá ze dvou vrstev:
 *   1. Automatika — výkop prvního zápasu fáze (skupiny = globální
 *      `tournament.deadline`, každé vyřazovací kolo = `min(dateUtc)` jeho zápasů).
 *   2. Ruční přebití (`DeadlineOverride`) — admin v `/admin/uzaverky`.
 *
 * Každé KOLO (STAGE scope) má režim:
 *   - "FIXED"   — celé kolo se uzavře v jeden termín (ruční `deadline`, nebo
 *                 automatika = výkop prvního zápasu).
 *   - "KICKOFF" — každý zápas kola se uzavře (a u skupin i odhalí cizí tipy)
 *                 svým vlastním výkopem.
 *
 * Priorita pro zápas: override zápasu > STAGE (FIXED deadline / KICKOFF výkop) >
 * automatika.
 *
 * Uzávěrka skupinové fáze zároveň spouští zveřejnění cizích tipů. V režimu
 * KICKOFF se odhaluje po jednotlivých zápasech (tip se odhalí svým výkopem,
 * v ten okamžik se i uzamkne).
 */
import "server-only";

import { tournament } from "@/config/tournament";
import { db } from "@/lib/db";

/** Fáze, pro které lze nastavit ruční uzávěrku celého kola. */
export const OVERRIDE_STAGES = [
  "GROUP",
  "ROUND_OF_32",
  "ROUND_OF_16",
  "QUARTER_FINAL",
  "SEMI_FINAL",
  "THIRD_PLACE",
  "FINAL",
] as const;

export const SCOPE_RANKINGS = "GROUP_RANKINGS";
export const SCOPE_SPECIALS = "SPECIALS";

export type DeadlineMode = "FIXED" | "KICKOFF";

export function stageScope(stage: string): string {
  return `STAGE:${stage}`;
}
export function matchScope(matchId: string): string {
  return `MATCH:${matchId}`;
}

/** Ověří, že `scope` je jeden z povolených tvarů (bez kontroly existence zápasu). */
export function isValidDeadlineScope(scope: string): boolean {
  if (scope === SCOPE_RANKINGS || scope === SCOPE_SPECIALS) return true;
  if (scope.startsWith("STAGE:")) {
    return (OVERRIDE_STAGES as readonly string[]).includes(scope.slice(6));
  }
  if (scope.startsWith("MATCH:")) return scope.length > 6;
  return false;
}

/** Režim KICKOFF dává smysl jen pro celé kolo (STAGE scope). */
export function scopeSupportsKickoffMode(scope: string): boolean {
  return scope.startsWith("STAGE:");
}

interface OverrideRow {
  mode: DeadlineMode;
  deadline: Date | null;
}

// -----------------------------------------------------------------------------
// Kontext (načte se jednou, spočítá všechny efektivní uzávěrky)
// -----------------------------------------------------------------------------

export interface MatchLike {
  id: string;
  stage: string;
  dateUtc: Date;
}

export interface DeadlineContext {
  /** Všechna ruční přebití (scope → {mode, deadline}). */
  overrides: Map<string, OverrideRow>;
  /** Režim daného kola ("FIXED", pokud není nastaven jinak). */
  stageMode(stage: string): DeadlineMode;
  /** Automatická uzávěrka fáze (výkop prvního zápasu / globální deadline). */
  stageAutoDeadline(stage: string): Date;
  /** Efektivní uzávěrka celého kola (v režimu KICKOFF = výkop posledního zápasu). */
  stageDeadline(stage: string): Date;
  /** Efektivní uzávěrka jednoho zápasu. */
  matchDeadline(match: MatchLike): Date;
  rankingsDeadline(): Date;
  specialsDeadline(): Date;
  /** Je zápas právě uzamčený (a tím i odhalený)? */
  matchLocked(match: MatchLike, now?: Date): boolean;
  /** Je skupinová fáze jako celek uzavřená? */
  groupPhaseClosed(now?: Date): boolean;
  rankingsClosed(now?: Date): boolean;
  specialsClosed(now?: Date): boolean;
}

export async function loadDeadlineContext(): Promise<DeadlineContext> {
  const [overrideRows, stageAggs] = await Promise.all([
    db.deadlineOverride.findMany(),
    db.match.groupBy({
      by: ["stage"],
      _min: { dateUtc: true },
      _max: { dateUtc: true },
    }),
  ]);

  const overrides = new Map<string, OverrideRow>(
    overrideRows.map((r) => [
      r.scope,
      { mode: (r.mode as DeadlineMode) ?? "FIXED", deadline: r.deadline },
    ])
  );
  const minKickoff = new Map<string, Date>();
  const maxKickoff = new Map<string, Date>();
  for (const s of stageAggs) {
    if (s._min.dateUtc) minKickoff.set(s.stage, s._min.dateUtc);
    if (s._max.dateUtc) maxKickoff.set(s.stage, s._max.dateUtc);
  }

  const stageAutoDeadline = (stage: string): Date =>
    stage === "GROUP"
      ? tournament.deadline
      : minKickoff.get(stage) ?? tournament.deadline;

  const stageMode = (stage: string): DeadlineMode =>
    overrides.get(stageScope(stage))?.mode ?? "FIXED";

  const stageDeadline = (stage: string): Date => {
    const row = overrides.get(stageScope(stage));
    if (row?.mode === "KICKOFF") {
      // Celé kolo je uzavřené, až začne jeho poslední zápas.
      return maxKickoff.get(stage) ?? stageAutoDeadline(stage);
    }
    return row?.deadline ?? stageAutoDeadline(stage);
  };

  const matchDeadline = (match: MatchLike): Date => {
    const mrow = overrides.get(matchScope(match.id));
    if (mrow?.deadline) return mrow.deadline; // override zápasu je vždy FIXED
    const srow = overrides.get(stageScope(match.stage));
    if (srow?.mode === "KICKOFF") return match.dateUtc;
    return srow?.deadline ?? stageAutoDeadline(match.stage);
  };

  const rankingsDeadline = (): Date =>
    overrides.get(SCOPE_RANKINGS)?.deadline ?? tournament.deadline;
  const specialsDeadline = (): Date =>
    overrides.get(SCOPE_SPECIALS)?.deadline ?? tournament.deadline;

  const passed = (d: Date, now: Date) => now.getTime() >= d.getTime();

  return {
    overrides,
    stageMode,
    stageAutoDeadline,
    stageDeadline,
    matchDeadline,
    rankingsDeadline,
    specialsDeadline,
    matchLocked: (match, now = new Date()) => passed(matchDeadline(match), now),
    groupPhaseClosed: (now = new Date()) => passed(stageDeadline("GROUP"), now),
    rankingsClosed: (now = new Date()) => passed(rankingsDeadline(), now),
    specialsClosed: (now = new Date()) => passed(specialsDeadline(), now),
  };
}

// -----------------------------------------------------------------------------
// Lehké jednorázové dotazy (pro místa, kde stačí jeden údaj)
// -----------------------------------------------------------------------------

/**
 * Efektivní uzávěrka skupinové fáze jako celku (= i „turnaj odstartoval").
 * V režimu KICKOFF = výkop posledního skupinového zápasu.
 */
export async function groupPhaseDeadline(): Promise<Date> {
  const row = await db.deadlineOverride.findUnique({
    where: { scope: stageScope("GROUP") },
  });
  if (row?.mode === "KICKOFF") {
    const agg = await db.match.aggregate({
      where: { stage: "GROUP" },
      _max: { dateUtc: true },
    });
    return agg._max.dateUtc ?? tournament.deadline;
  }
  return row?.deadline ?? tournament.deadline;
}

/** Je skupinová fáze uzavřená? Nahrazuje původní `isDeadlinePassed()`. */
export async function isGroupPhaseClosed(now: Date = new Date()): Promise<boolean> {
  return now.getTime() >= (await groupPhaseDeadline()).getTime();
}

export async function rankingsDeadline(): Promise<Date> {
  const row = await db.deadlineOverride.findUnique({
    where: { scope: SCOPE_RANKINGS },
  });
  return row?.deadline ?? tournament.deadline;
}
export async function isRankingsClosed(now: Date = new Date()): Promise<boolean> {
  return now.getTime() >= (await rankingsDeadline()).getTime();
}

export async function specialsDeadline(): Promise<Date> {
  const row = await db.deadlineOverride.findUnique({
    where: { scope: SCOPE_SPECIALS },
  });
  return row?.deadline ?? tournament.deadline;
}
export async function isSpecialsClosed(now: Date = new Date()): Promise<boolean> {
  return now.getTime() >= (await specialsDeadline()).getTime();
}
