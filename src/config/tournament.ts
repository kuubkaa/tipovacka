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

  // QR kód pro platbu startovného (obrázek v /public). Po deadlinu se
  // nezaplaceným tipérům ukazuje okno s tímto QR. Vyměnitelné za nový ročník.
  paymentQrUrl: "/qr-platba.jpg",

  // Jeden společný deadline pro VŠECHNY tipy (zápasy, pořadí skupin,
  // speciální tipy). Prvním výkopem se vše zamkne i zveřejní najednou.
  // 11. června 2026 21:00 SELČ = výkop úvodního zápasu MEX–RSA.
  deadline: new Date("2026-06-11T21:00:00+02:00"),

  // Email zobrazený v patičce pro dotazy
  contactEmail: "jakubmilotinsky@gmail.com",

  // Patička
  organizer: "Jakub Milotinský",

  // Výhry pro první tři místa v pořadí tipérů (CZK). Zobrazují se na
  // leaderboardu a zvýrazňují medailová místa. Pro nový ročník přepiš.
  prizes: [
    { place: 1, amountCzk: 3400, label: "1. místo" },
    { place: 2, amountCzk: 2040, label: "2. místo" },
    { place: 3, amountCzk: 1360, label: "3. místo" },
  ],
} as const;

/** Formátuje částku v Kč podle českých zvyklostí (mezera jako oddělovač). */
export function formatCzk(amount: number): string {
  return `${amount.toLocaleString("cs-CZ")} Kč`;
}

export type Tournament = typeof tournament;

/**
 * Pomocná funkce — vrací true, pokud už deadline (výkop prvního zápasu)
 * uplynul. Po něm jsou všechny tipy uzamčené a zároveň se zveřejní
 * tipy všech uživatelů.
 */
export function isDeadlinePassed(now: Date = new Date()): boolean {
  return now.getTime() >= tournament.deadline.getTime();
}
