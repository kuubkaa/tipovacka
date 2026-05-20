import { cn } from "@/lib/utils";

/**
 * Převede vlajkové emoji na kód pro flagcdn.com.
 * - Páry regionálních indikátorů (🇨🇿) → ISO 3166-1 alpha-2 ("cz").
 * - Tag sekvence (🏴󠁧󠁢󠁳󠁣󠁴󠁿 Skotsko) → "gb-sct".
 * Vrátí null pro nerozpoznané emoji (pak se vykreslí emoji jako fallback).
 */
function flagEmojiToCode(emoji: string): string | null {
  const cps = [...emoji].map((c) => c.codePointAt(0) ?? 0);

  if (cps.length === 2 && cps[0] >= 0x1f1e6 && cps[0] <= 0x1f1ff) {
    return String.fromCharCode(...cps.map((c) => c - 0x1f1e6 + 97));
  }

  if (cps[0] === 0x1f3f4) {
    const letters = cps
      .slice(1)
      .filter((c) => c >= 0xe0061 && c <= 0xe007a)
      .map((c) => String.fromCharCode(c - 0xe0061 + 97))
      .join("");
    if (letters.length >= 4) {
      return `${letters.slice(0, 2)}-${letters.slice(2)}`;
    }
  }

  return null;
}

/**
 * Vlajka jako obrázek (ne emoji). Důvod: iOS Safari přelévá barvu
 * barevného emoji do textu na stejném řádku — obrázek tenhle problém
 * fyzicky nemůže způsobit. Sjednocuje i vzhled napříč platformami.
 */
export function Flag({
  emoji,
  name,
  className,
}: {
  emoji: string | null;
  name?: string;
  className?: string;
}) {
  const code = emoji ? flagEmojiToCode(emoji) : null;

  if (!code) {
    // Fallback: nerozpoznané emoji vykreslíme tak jak je.
    return (
      <span className={className} aria-hidden>
        {emoji}
      </span>
    );
  }

  return (
    // Záměrně nativní <img> (ne next/image) — externí SVG bez nutnosti
    // konfigurovat remotePatterns. Stejný přístup jako u loga.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://flagcdn.com/${code}.svg`}
      alt={name ? `Vlajka: ${name}` : ""}
      aria-hidden={!name}
      loading="lazy"
      className={cn(
        "inline-block h-3.5 w-5 shrink-0 rounded-[2px] object-cover ring-1 ring-black/10",
        className
      )}
    />
  );
}
