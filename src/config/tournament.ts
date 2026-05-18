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
  logoUrl: "/logo.png",

  // Deadline pro odevzdání tipů na pořadí skupin a speciálních tipů.
  // Zápasy mají vlastní deadline = výkop daného utkání.
  // 11. června 2026 21:00 SELČ = výkop úvodního zápasu MEX–RSA.
  deadline: new Date("2026-06-11T21:00:00+02:00"),

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
