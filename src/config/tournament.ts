/**
 * Konfigurace turnaje.
 *
 * Pro nový ročník stačí přepsat hodnoty zde + nahradit /public/logo.svg.
 * Branding barvy se mění v src/app/globals.css (proměnné --primary, --accent).
 */
export const tournament = {
  name: "Tipovačka MS 2026",
  shortName: "MS 2026",
  subtitle: "Mistrovství světa ve fotbale — USA, Kanada, Mexiko",
  year: 2026,

  // Cesta k logu v adresáři /public
  logoUrl: "/logo.svg",

  // Deadline pro odevzdání tipů (po tomto datu se zobrazí tipy všech)
  // Start MS 2026: 11. června 2026, 20:00 SELČ
  // TEMP: deadline v minulosti pro preview /tipy (vrátit zpět po kontrole)
  deadline: new Date("2026-05-01T20:00:00+02:00"),

  // Email zobrazený v patičce pro dotazy
  contactEmail: "jakubmilotinsky@gmail.com",

  // Patička
  organizer: "Jakub Milotinský",
} as const;

export type Tournament = typeof tournament;

/**
 * Pomocná funkce — vrací true, pokud už deadline uplynul
 * a mají se zobrazit tipy všech uživatelů.
 */
export function isDeadlinePassed(now: Date = new Date()): boolean {
  return now.getTime() >= tournament.deadline.getTime();
}
