/**
 * Převod mezi pražským "nástěnným" časem (co admin vidí a zadává v poli
 * <input type="datetime-local">) a UTC instantem uloženým v DB.
 *
 * Proč to není triv: server (Vercel) běží v UTC, takže `new Date("...T21:00")`
 * by hodnotu bez zóny vzal jako 21:00 UTC, ne jako 21:00 v Praze. Tady
 * převádíme správně přes skutečný offset pražské zóny v daný okamžik
 * (funguje v zimním i letním čase, takže je to bezpečné i pro jiné ročníky).
 */
const PRAGUE_TZ = "Europe/Prague";

/** Offset pražské zóny vůči UTC (v ms) pro daný okamžik. */
function pragueOffsetMs(instant: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: PRAGUE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = dtf.formatToParts(instant);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  // 24:00 (půlnoc) některé enginy reportují jako hour "24" → znormalizuj.
  const hour = map.hour === "24" ? 0 : Number(map.hour);
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    hour,
    Number(map.minute),
    Number(map.second)
  );
  return asUtc - instant.getTime();
}

/**
 * "2026-06-28T21:00" (pražský nástěnný čas) → UTC Date.
 * Vrací null, pokud je vstup neplatný.
 */
export function pragueLocalToUtc(local: string): Date | null {
  if (!local) return null;
  // Doplň sekundy, pokud chybí, a interpretuj string nejdřív jako UTC.
  const withSeconds = local.length === 16 ? `${local}:00` : local;
  const naive = new Date(`${withSeconds}Z`);
  if (isNaN(naive.getTime())) return null;
  // Skutečný UTC instant = nástěnný čas minus pražský offset v tu chvíli.
  const offset = pragueOffsetMs(naive);
  return new Date(naive.getTime() - offset);
}

/**
 * UTC Date → "2026-06-28T21:00" pražský nástěnný čas pro <input
 * type="datetime-local">.
 */
export function utcToPragueLocal(d: Date): string {
  const offset = pragueOffsetMs(d);
  const local = new Date(d.getTime() + offset);
  return local.toISOString().slice(0, 16);
}
