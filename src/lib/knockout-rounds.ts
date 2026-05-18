/**
 * Definice vyřazovacích kol, na která bere tipovačka tipy "postupující".
 *
 * Sdílené mezi server actions (actions.ts) a client komponentou
 * (special-tips-form.tsx). MUSÍ ležet v souboru bez "use server" direktivy
 * — jinak by Next.js zabalil konstantu jako server action a klient by ji
 * nemohl iterovat (TypeError: h is not iterable).
 */
export const KNOCKOUT_ADVANCERS_ROUNDS = [
  { key: "R32", stage: "ROUND_OF_32" as const, targetCount: 32, label: "Šestnáctifinále" },
  { key: "R16", stage: "ROUND_OF_16" as const, targetCount: 16, label: "Osmifinále" },
  { key: "QF", stage: "QUARTER_FINAL" as const, targetCount: 8, label: "Čtvrtfinále" },
  { key: "SF", stage: "SEMI_FINAL" as const, targetCount: 4, label: "Semifinále" },
  { key: "BRONZ", stage: "THIRD_PLACE" as const, targetCount: 2, label: "O 3. místo" },
  { key: "F", stage: "FINAL" as const, targetCount: 2, label: "Finále" },
] as const;

export type KnockoutRound = (typeof KNOCKOUT_ADVANCERS_ROUNDS)[number];
