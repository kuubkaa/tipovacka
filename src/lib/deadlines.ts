/**
 * Uzávěrky tipů — jedno místo pravdy.
 *
 * Uzávěrka se skládá ze dvou vrstev:
 *   1. Automatika — výkop prvního zápasu fáze (skupiny = globální
 *      `tournament.deadline`, každé vyřazovací kolo = `min(dateUtc)` jeho zápasů).
 *   2. Ruční přebití (`DeadlineOverride`) — admin v `/admin/uzaverky` nastaví
 *      vlastní datum a čas pro celé kolo, jednotlivý zápas nebo pořadí skupin /
 *      speciály. Když override existuje, platí MÍSTO automatiky.
 *
 * Priorita pro zápas: override zápasu > override kola > automatika.
 *
 * Uzávěrka skupinové fáze zároveň spouští zveřejnění cizích tipů (tipy/,
 * leaderboard/prehled). Proto reveal jede přes stejnou efektivní uzávěrku.
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

// -----------------------------------------------------------------------------
// Kontext (načte se jednou, spočítá všechny efektivní uzávěrky)
// -----------------------------------------------------------------------------

export interface DeadlineContext {
  /** Všechna ruční přebití (scope → deadline). */
  overrides: Map<string, Date>;
  /** Automatická uzávěrka fáze (výkop prvního zápasu / globální deadline). */
  stageAutoDeadline(stage: string): Date;
  /** Efektivní uzávěrka celého kola (override kola ?? automatika). */
  stageDeadline(stage: string): Date;
  /** Efektivní uzávěrka jednoho zápasu (override zápasu ?? override kola ?? automatika). */
  matchDeadline(match: { id: string; stage: string }): Date;
  rankingsDeadline(): Date;
  specialsDeadline(): Date;
  /** Je zápas právě uzamčený? */
  matchLocked(match: { id: string; stage: string }, now?: Date): boolean;
  /** Je skupinová fáze uzavřená? (= zamčené skupinové zápasy + zveřejnění cizích tipů) */
  groupPhaseClosed(now?: Date): boolean;
  rankingsClosed(now?: Date): boolean;
  specialsClosed(now?: Date): boolean;
}

export async function loadDeadlineContext(): Promise<DeadlineContext> {
  const [overrideRows, stageMins] = await Promise.all([
    db.deadlineOverride.findMany(),
    db.match.groupBy({ by: ["stage"], _min: { dateUtc: true } }),
  ]);

  const overrides = new Map(overrideRows.map((r) => [r.scope, r.deadline]));
  const autoKickoff = new Map<string, Date>();
  for (const s of stageMins) {
    if (s._min.dateUtc) autoKickoff.set(s.stage, s._min.dateUtc);
  }

  const stageAutoDeadline = (stage: string): Date =>
    stage === "GROUP"
      ? tournament.deadline
      : autoKickoff.get(stage) ?? tournament.deadline;

  const stageDeadline = (stage: string): Date =>
    overrides.get(stageScope(stage)) ?? stageAutoDeadline(stage);

  const matchDeadline = (match: { id: string; stage: string }): Date =>
    overrides.get(matchScope(match.id)) ?? stageDeadline(match.stage);

  const rankingsDeadline = (): Date =>
    overrides.get(SCOPE_RANKINGS) ?? tournament.deadline;
  const specialsDeadline = (): Date =>
    overrides.get(SCOPE_SPECIALS) ?? tournament.deadline;

  const passed = (d: Date, now: Date) => now.getTime() >= d.getTime();

  return {
    overrides,
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

async function overrideFor(scope: string): Promise<Date | null> {
  const row = await db.deadlineOverride.findUnique({ where: { scope } });
  return row?.deadline ?? null;
}

/** Efektivní uzávěrka skupinové fáze (= i okamžik zveřejnění cizích tipů). */
export async function groupPhaseDeadline(): Promise<Date> {
  return (await overrideFor(stageScope("GROUP"))) ?? tournament.deadline;
}

/** Je skupinová fáze uzavřená? Nahrazuje původní `isDeadlinePassed()`. */
export async function isGroupPhaseClosed(now: Date = new Date()): Promise<boolean> {
  return now.getTime() >= (await groupPhaseDeadline()).getTime();
}

export async function rankingsDeadline(): Promise<Date> {
  return (await overrideFor(SCOPE_RANKINGS)) ?? tournament.deadline;
}
export async function isRankingsClosed(now: Date = new Date()): Promise<boolean> {
  return now.getTime() >= (await rankingsDeadline()).getTime();
}

export async function specialsDeadline(): Promise<Date> {
  return (await overrideFor(SCOPE_SPECIALS)) ?? tournament.deadline;
}
export async function isSpecialsClosed(now: Date = new Date()): Promise<boolean> {
  return now.getTime() >= (await specialsDeadline()).getTime();
}
