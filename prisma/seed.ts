/**
 * Seed pro MS 2026: 48 týmů ve 12 skupinách + 72 zápasů základní skupiny.
 *
 * Spusť: `npm run db:seed`
 *
 * Idempotentní — upserty podle `Team.code` a `Match.matchKey`.
 *
 * Datumy jsou ve formátu ISO 8601 s offsetem `+01:00` (UK letní čas / BST).
 * Prisma je převede na UTC při uložení. Pro zobrazení v UI je převedeme
 * podle uživatelovy timezone (předpokládáme Prahu, CEST = UTC+2).
 *
 * Vyřazovací fáze (R32 → finále) se seedovat NEBUDE — týmy se určí až
 * podle výsledků skupin. Po skončení skupin admin vygeneruje pavouka.
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString =
  process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL_UNPOOLED nebo DATABASE_URL musí být nastavena.");
}

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

// =============================================================================
// Týmy — 48 účastníků MS 2026, seřazené po skupinách
// =============================================================================

type GroupLetter =
  | "A" | "B" | "C" | "D" | "E" | "F"
  | "G" | "H" | "I" | "J" | "K" | "L";

interface TeamSeed {
  code: string;        // FIFA 3-letter kód (unikátní)
  name: string;        // český název pro UI
  flagEmoji: string;   // vlajka
  group: GroupLetter;
}

const TEAMS: TeamSeed[] = [
  // Skupina A
  { code: "MEX", name: "Mexiko", flagEmoji: "🇲🇽", group: "A" },
  { code: "RSA", name: "Jihoafrická republika", flagEmoji: "🇿🇦", group: "A" },
  { code: "KOR", name: "Jižní Korea", flagEmoji: "🇰🇷", group: "A" },
  { code: "CZE", name: "Česko", flagEmoji: "🇨🇿", group: "A" },

  // Skupina B
  { code: "CAN", name: "Kanada", flagEmoji: "🇨🇦", group: "B" },
  { code: "BIH", name: "Bosna a Hercegovina", flagEmoji: "🇧🇦", group: "B" },
  { code: "QAT", name: "Katar", flagEmoji: "🇶🇦", group: "B" },
  { code: "SUI", name: "Švýcarsko", flagEmoji: "🇨🇭", group: "B" },

  // Skupina C
  { code: "BRA", name: "Brazílie", flagEmoji: "🇧🇷", group: "C" },
  { code: "MAR", name: "Maroko", flagEmoji: "🇲🇦", group: "C" },
  { code: "HAI", name: "Haiti", flagEmoji: "🇭🇹", group: "C" },
  { code: "SCO", name: "Skotsko", flagEmoji: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", group: "C" },

  // Skupina D
  { code: "USA", name: "USA", flagEmoji: "🇺🇸", group: "D" },
  { code: "PAR", name: "Paraguay", flagEmoji: "🇵🇾", group: "D" },
  { code: "AUS", name: "Austrálie", flagEmoji: "🇦🇺", group: "D" },
  { code: "TUR", name: "Turecko", flagEmoji: "🇹🇷", group: "D" },

  // Skupina E
  { code: "GER", name: "Německo", flagEmoji: "🇩🇪", group: "E" },
  { code: "CUW", name: "Curaçao", flagEmoji: "🇨🇼", group: "E" },
  { code: "CIV", name: "Pobřeží slonoviny", flagEmoji: "🇨🇮", group: "E" },
  { code: "ECU", name: "Ekvádor", flagEmoji: "🇪🇨", group: "E" },

  // Skupina F
  { code: "NED", name: "Nizozemsko", flagEmoji: "🇳🇱", group: "F" },
  { code: "JPN", name: "Japonsko", flagEmoji: "🇯🇵", group: "F" },
  { code: "SWE", name: "Švédsko", flagEmoji: "🇸🇪", group: "F" },
  { code: "TUN", name: "Tunisko", flagEmoji: "🇹🇳", group: "F" },

  // Skupina G
  { code: "BEL", name: "Belgie", flagEmoji: "🇧🇪", group: "G" },
  { code: "EGY", name: "Egypt", flagEmoji: "🇪🇬", group: "G" },
  { code: "IRN", name: "Írán", flagEmoji: "🇮🇷", group: "G" },
  { code: "NZL", name: "Nový Zéland", flagEmoji: "🇳🇿", group: "G" },

  // Skupina H
  { code: "ESP", name: "Španělsko", flagEmoji: "🇪🇸", group: "H" },
  { code: "CPV", name: "Kapverdy", flagEmoji: "🇨🇻", group: "H" },
  { code: "KSA", name: "Saúdská Arábie", flagEmoji: "🇸🇦", group: "H" },
  { code: "URU", name: "Uruguay", flagEmoji: "🇺🇾", group: "H" },

  // Skupina I
  { code: "FRA", name: "Francie", flagEmoji: "🇫🇷", group: "I" },
  { code: "SEN", name: "Senegal", flagEmoji: "🇸🇳", group: "I" },
  { code: "IRQ", name: "Irák", flagEmoji: "🇮🇶", group: "I" },
  { code: "NOR", name: "Norsko", flagEmoji: "🇳🇴", group: "I" },

  // Skupina J
  { code: "ARG", name: "Argentina", flagEmoji: "🇦🇷", group: "J" },
  { code: "ALG", name: "Alžírsko", flagEmoji: "🇩🇿", group: "J" },
  { code: "AUT", name: "Rakousko", flagEmoji: "🇦🇹", group: "J" },
  { code: "JOR", name: "Jordánsko", flagEmoji: "🇯🇴", group: "J" },

  // Skupina K
  { code: "POR", name: "Portugalsko", flagEmoji: "🇵🇹", group: "K" },
  { code: "COD", name: "DR Kongo", flagEmoji: "🇨🇩", group: "K" },
  { code: "UZB", name: "Uzbekistán", flagEmoji: "🇺🇿", group: "K" },
  { code: "COL", name: "Kolumbie", flagEmoji: "🇨🇴", group: "K" },

  // Skupina L
  { code: "ENG", name: "Anglie", flagEmoji: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", group: "L" },
  { code: "CRO", name: "Chorvatsko", flagEmoji: "🇭🇷", group: "L" },
  { code: "GHA", name: "Ghana", flagEmoji: "🇬🇭", group: "L" },
  { code: "PAN", name: "Panama", flagEmoji: "🇵🇦", group: "L" },
];

// =============================================================================
// Zápasy základní skupiny — 72 zápasů v chronologickém pořadí
// Datum/čas: ISO 8601 s offsetem +01:00 (UK BST). Prisma uloží UTC.
// =============================================================================

interface MatchSeed {
  matchKey: string;
  group: GroupLetter;
  dateUtc: string;     // ISO 8601, parsuje se Date konstruktorem
  home: string;        // Team.code
  away: string;        // Team.code
}

const MATCHES: MatchSeed[] = [
  // 1. kolo skupin (11.–17. června)
  { matchKey: "M01", group: "A", dateUtc: "2026-06-11T20:00:00+01:00", home: "MEX", away: "RSA" },
  { matchKey: "M02", group: "A", dateUtc: "2026-06-12T03:00:00+01:00", home: "KOR", away: "CZE" },
  { matchKey: "M03", group: "B", dateUtc: "2026-06-12T20:00:00+01:00", home: "CAN", away: "BIH" },
  { matchKey: "M04", group: "D", dateUtc: "2026-06-13T02:00:00+01:00", home: "USA", away: "PAR" },
  { matchKey: "M05", group: "B", dateUtc: "2026-06-13T20:00:00+01:00", home: "QAT", away: "SUI" },
  { matchKey: "M06", group: "C", dateUtc: "2026-06-13T23:00:00+01:00", home: "BRA", away: "MAR" },
  { matchKey: "M07", group: "C", dateUtc: "2026-06-14T02:00:00+01:00", home: "HAI", away: "SCO" },
  { matchKey: "M08", group: "D", dateUtc: "2026-06-14T05:00:00+01:00", home: "AUS", away: "TUR" },
  { matchKey: "M09", group: "E", dateUtc: "2026-06-14T18:00:00+01:00", home: "GER", away: "CUW" },
  { matchKey: "M10", group: "F", dateUtc: "2026-06-14T21:00:00+01:00", home: "NED", away: "JPN" },
  { matchKey: "M11", group: "E", dateUtc: "2026-06-15T00:00:00+01:00", home: "CIV", away: "ECU" },
  { matchKey: "M12", group: "F", dateUtc: "2026-06-15T03:00:00+01:00", home: "SWE", away: "TUN" },
  { matchKey: "M13", group: "H", dateUtc: "2026-06-15T17:00:00+01:00", home: "ESP", away: "CPV" },
  { matchKey: "M14", group: "G", dateUtc: "2026-06-15T20:00:00+01:00", home: "BEL", away: "EGY" },
  { matchKey: "M15", group: "H", dateUtc: "2026-06-15T23:00:00+01:00", home: "KSA", away: "URU" },
  { matchKey: "M16", group: "G", dateUtc: "2026-06-16T02:00:00+01:00", home: "IRN", away: "NZL" },
  { matchKey: "M17", group: "I", dateUtc: "2026-06-16T20:00:00+01:00", home: "FRA", away: "SEN" },
  { matchKey: "M18", group: "I", dateUtc: "2026-06-16T23:00:00+01:00", home: "IRQ", away: "NOR" },
  { matchKey: "M19", group: "J", dateUtc: "2026-06-17T02:00:00+01:00", home: "ARG", away: "ALG" },
  { matchKey: "M20", group: "J", dateUtc: "2026-06-17T05:00:00+01:00", home: "AUT", away: "JOR" },
  { matchKey: "M21", group: "K", dateUtc: "2026-06-17T18:00:00+01:00", home: "POR", away: "COD" },
  { matchKey: "M22", group: "L", dateUtc: "2026-06-17T21:00:00+01:00", home: "ENG", away: "CRO" },
  { matchKey: "M23", group: "L", dateUtc: "2026-06-18T00:00:00+01:00", home: "GHA", away: "PAN" },
  { matchKey: "M24", group: "K", dateUtc: "2026-06-18T03:00:00+01:00", home: "UZB", away: "COL" },

  // 2. kolo skupin (18.–24. června)
  { matchKey: "M25", group: "A", dateUtc: "2026-06-18T17:00:00+01:00", home: "CZE", away: "RSA" },
  { matchKey: "M26", group: "B", dateUtc: "2026-06-18T20:00:00+01:00", home: "SUI", away: "BIH" },
  { matchKey: "M27", group: "B", dateUtc: "2026-06-18T23:00:00+01:00", home: "CAN", away: "QAT" },
  { matchKey: "M28", group: "A", dateUtc: "2026-06-19T02:00:00+01:00", home: "MEX", away: "KOR" },
  { matchKey: "M29", group: "D", dateUtc: "2026-06-19T20:00:00+01:00", home: "USA", away: "AUS" },
  { matchKey: "M30", group: "C", dateUtc: "2026-06-19T23:00:00+01:00", home: "SCO", away: "MAR" },
  { matchKey: "M31", group: "C", dateUtc: "2026-06-20T01:30:00+01:00", home: "BRA", away: "HAI" },
  { matchKey: "M32", group: "D", dateUtc: "2026-06-20T04:00:00+01:00", home: "TUR", away: "PAR" },
  { matchKey: "M33", group: "F", dateUtc: "2026-06-20T18:00:00+01:00", home: "NED", away: "SWE" },
  { matchKey: "M34", group: "E", dateUtc: "2026-06-20T21:00:00+01:00", home: "GER", away: "CIV" },
  { matchKey: "M35", group: "E", dateUtc: "2026-06-21T01:00:00+01:00", home: "ECU", away: "CUW" },
  { matchKey: "M36", group: "F", dateUtc: "2026-06-21T05:00:00+01:00", home: "TUN", away: "JPN" },
  { matchKey: "M37", group: "H", dateUtc: "2026-06-21T17:00:00+01:00", home: "ESP", away: "KSA" },
  { matchKey: "M38", group: "G", dateUtc: "2026-06-21T20:00:00+01:00", home: "BEL", away: "IRN" },
  { matchKey: "M39", group: "H", dateUtc: "2026-06-21T23:00:00+01:00", home: "URU", away: "CPV" },
  { matchKey: "M40", group: "G", dateUtc: "2026-06-22T02:00:00+01:00", home: "NZL", away: "EGY" },
  { matchKey: "M41", group: "J", dateUtc: "2026-06-22T18:00:00+01:00", home: "ARG", away: "AUT" },
  { matchKey: "M42", group: "I", dateUtc: "2026-06-22T22:00:00+01:00", home: "FRA", away: "IRQ" },
  { matchKey: "M43", group: "I", dateUtc: "2026-06-23T01:00:00+01:00", home: "NOR", away: "SEN" },
  { matchKey: "M44", group: "J", dateUtc: "2026-06-23T04:00:00+01:00", home: "JOR", away: "ALG" },
  { matchKey: "M45", group: "K", dateUtc: "2026-06-23T18:00:00+01:00", home: "POR", away: "UZB" },
  { matchKey: "M46", group: "L", dateUtc: "2026-06-23T21:00:00+01:00", home: "ENG", away: "GHA" },
  { matchKey: "M47", group: "L", dateUtc: "2026-06-24T00:00:00+01:00", home: "PAN", away: "CRO" },
  { matchKey: "M48", group: "K", dateUtc: "2026-06-24T03:00:00+01:00", home: "COL", away: "COD" },

  // 3. kolo skupin (souběžné dvojice, 24.–28. června)
  { matchKey: "M49", group: "B", dateUtc: "2026-06-24T20:00:00+01:00", home: "SUI", away: "CAN" },
  { matchKey: "M50", group: "B", dateUtc: "2026-06-24T20:00:00+01:00", home: "BIH", away: "QAT" },
  { matchKey: "M51", group: "C", dateUtc: "2026-06-24T23:00:00+01:00", home: "MAR", away: "HAI" },
  { matchKey: "M52", group: "C", dateUtc: "2026-06-24T23:00:00+01:00", home: "SCO", away: "BRA" },
  { matchKey: "M53", group: "A", dateUtc: "2026-06-25T02:00:00+01:00", home: "RSA", away: "KOR" },
  { matchKey: "M54", group: "A", dateUtc: "2026-06-25T02:00:00+01:00", home: "CZE", away: "MEX" },
  { matchKey: "M55", group: "E", dateUtc: "2026-06-25T21:00:00+01:00", home: "CUW", away: "CIV" },
  { matchKey: "M56", group: "E", dateUtc: "2026-06-25T21:00:00+01:00", home: "ECU", away: "GER" },
  { matchKey: "M57", group: "F", dateUtc: "2026-06-26T00:00:00+01:00", home: "TUN", away: "NED" },
  { matchKey: "M58", group: "F", dateUtc: "2026-06-26T00:00:00+01:00", home: "JPN", away: "SWE" },
  { matchKey: "M59", group: "D", dateUtc: "2026-06-26T03:00:00+01:00", home: "TUR", away: "USA" },
  { matchKey: "M60", group: "D", dateUtc: "2026-06-26T03:00:00+01:00", home: "PAR", away: "AUS" },
  { matchKey: "M61", group: "I", dateUtc: "2026-06-26T20:00:00+01:00", home: "NOR", away: "FRA" },
  { matchKey: "M62", group: "I", dateUtc: "2026-06-26T20:00:00+01:00", home: "SEN", away: "IRQ" },
  { matchKey: "M63", group: "H", dateUtc: "2026-06-27T01:00:00+01:00", home: "CPV", away: "KSA" },
  { matchKey: "M64", group: "H", dateUtc: "2026-06-27T01:00:00+01:00", home: "URU", away: "ESP" },
  { matchKey: "M65", group: "G", dateUtc: "2026-06-27T04:00:00+01:00", home: "NZL", away: "BEL" },
  { matchKey: "M66", group: "G", dateUtc: "2026-06-27T04:00:00+01:00", home: "EGY", away: "IRN" },
  { matchKey: "M67", group: "L", dateUtc: "2026-06-27T22:00:00+01:00", home: "PAN", away: "ENG" },
  { matchKey: "M68", group: "L", dateUtc: "2026-06-27T22:00:00+01:00", home: "CRO", away: "GHA" },
  { matchKey: "M69", group: "K", dateUtc: "2026-06-28T00:30:00+01:00", home: "COL", away: "POR" },
  { matchKey: "M70", group: "K", dateUtc: "2026-06-28T00:30:00+01:00", home: "COD", away: "UZB" },
  { matchKey: "M71", group: "J", dateUtc: "2026-06-28T03:00:00+01:00", home: "ALG", away: "AUT" },
  { matchKey: "M72", group: "J", dateUtc: "2026-06-28T03:00:00+01:00", home: "JOR", away: "ARG" },
];

// =============================================================================
// Main
// =============================================================================

async function main() {
  console.log(`\nSeeding ${TEAMS.length} teams a ${MATCHES.length} zápasů…`);

  // 1) Upsert týmů
  for (const t of TEAMS) {
    await db.team.upsert({
      where: { code: t.code },
      create: t,
      update: t,
    });
  }
  console.log(`✓ ${TEAMS.length} týmů upsertnuto`);

  // 2) Načti všechny týmy a vytvoř mapu code -> id
  const allTeams = await db.team.findMany({
    select: { id: true, code: true },
  });
  const idByCode = new Map(allTeams.map((t) => [t.code, t.id]));

  // Validace: každý kód v MATCHES musí existovat v TEAMS
  const seen = new Set<string>();
  for (const m of MATCHES) {
    for (const code of [m.home, m.away]) {
      if (!idByCode.has(code)) {
        throw new Error(`Match ${m.matchKey}: neznámý team code "${code}"`);
      }
      seen.add(code);
    }
  }
  if (seen.size !== TEAMS.length) {
    console.warn(
      `⚠ Pozor — ${TEAMS.length - seen.size} týmů nemá žádný zápas v MATCHES`
    );
  }

  // 3) Upsert zápasů
  for (const m of MATCHES) {
    const homeTeamId = idByCode.get(m.home)!;
    const awayTeamId = idByCode.get(m.away)!;
    const data = {
      matchKey: m.matchKey,
      stage: "GROUP" as const,
      group: m.group,
      dateUtc: new Date(m.dateUtc),
      homeTeamId,
      awayTeamId,
    };
    await db.match.upsert({
      where: { matchKey: m.matchKey },
      create: data,
      update: data,
    });
  }
  console.log(`✓ ${MATCHES.length} zápasů upsertnuto`);

  // 4) Souhrn
  const teamCount = await db.team.count();
  const matchCount = await db.match.count({ where: { stage: "GROUP" } });
  console.log(`\nFinální stav DB: ${teamCount} týmů, ${matchCount} zápasů (GROUP).\n`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
