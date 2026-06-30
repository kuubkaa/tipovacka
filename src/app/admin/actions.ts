"use server";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { APP_URL } from "@/lib/app-url";
import { tournament } from "@/config/tournament";
import { db } from "@/lib/db";
import { KNOCKOUT_ADVANCERS_ROUNDS } from "@/lib/knockout-rounds";
import { isValidEmail, sendMail } from "@/lib/mailer";
import { pragueLocalToUtc } from "@/lib/prague-time";
import { normalizeName } from "@/lib/scoring";

const GROUP_LETTERS = [
  "A", "B", "C", "D", "E", "F",
  "G", "H", "I", "J", "K", "L",
] as const;
type GroupLetter = (typeof GROUP_LETTERS)[number];

async function requireAdminSession() {
  const session = await auth();
  if (!session?.user?.id) return null;
  if (!session.user.isAdmin) return null;
  return session;
}

/** Jednotná hláška pro neočekávané chyby (výpadek DB apod.) v admin akcích. */
const ADMIN_SAVE_ERROR =
  "Něco se pokazilo při ukládání. Zkus to prosím za chvíli znovu.";

export type SaveMatchResultsResult =
  | { status: "ok"; updated: number; cleared: number }
  | { status: "unauth" }
  | { status: "forbidden" }
  | { status: "error"; message: string };

/**
 * Admin akce — zapíše skutečné skóre zápasům. Vyžaduje `isAdmin = true`.
 *
 * FormData formát:
 *   home_<matchId> = number nebo prázdné
 *   away_<matchId> = number nebo prázdné
 *
 * Pravidla:
 * - Vyplněné oba = update.
 * - Oba prázdné = NULL (admin odbral výsledek).
 * - Jen jeden vyplněný nebo neplatné číslo = přeskoč.
 */
export async function saveMatchResultsAction(
  _prev: SaveMatchResultsResult | null,
  formData: FormData
): Promise<SaveMatchResultsResult> {
  try {
    return await saveMatchResults(formData);
  } catch (err) {
    console.error("[saveMatchResultsAction]", err);
    return { status: "error", message: ADMIN_SAVE_ERROR };
  }
}

async function saveMatchResults(
  formData: FormData
): Promise<SaveMatchResultsResult> {
  const session = await auth();
  if (!session?.user?.id) return { status: "unauth" };
  if (!session.user.isAdmin) return { status: "forbidden" };

  // Posbírej páry (matchId, home, away). Nepoužíváme deadline guard —
  // admin upravuje výsledky kdykoli.
  const ops: Array<{
    matchId: string;
    home: number | null;
    away: number | null;
  }> = [];
  const seen = new Set<string>();

  for (const [key] of formData.entries()) {
    const m = key.match(/^home_(.+)$/);
    if (!m) continue;
    const matchId = m[1];
    if (seen.has(matchId)) continue;
    seen.add(matchId);

    const homeStr = (formData.get(`home_${matchId}`) ?? "").toString().trim();
    const awayStr = (formData.get(`away_${matchId}`) ?? "").toString().trim();

    if (homeStr === "" && awayStr === "") {
      ops.push({ matchId, home: null, away: null });
      continue;
    }

    const home = Number(homeStr);
    const away = Number(awayStr);
    if (
      !Number.isInteger(home) ||
      !Number.isInteger(away) ||
      home < 0 ||
      away < 0 ||
      home > 99 ||
      away > 99
    ) {
      continue;
    }
    ops.push({ matchId, home, away });
  }

  // Ověř, že match IDs existují (proti podvržení formuláře)
  const matchIds = ops.map((o) => o.matchId);
  const validMatches = await db.match.findMany({
    where: { id: { in: matchIds } },
    select: { id: true, homeScore: true, awayScore: true },
  });
  const byId = new Map(validMatches.map((m) => [m.id, m]));

  let updated = 0;
  let cleared = 0;

  for (const op of ops) {
    const current = byId.get(op.matchId);
    if (!current) continue;

    if (op.home === null && op.away === null) {
      // Clear — jen pokud opravdu měl uložené skóre
      if (current.homeScore === null && current.awayScore === null) continue;
      await db.match.update({
        where: { id: op.matchId },
        data: { homeScore: null, awayScore: null },
      });
      cleared++;
    } else {
      // Pokud se hodnoty nemění, nepiš zbytečně
      if (
        current.homeScore === op.home &&
        current.awayScore === op.away
      ) {
        continue;
      }
      await db.match.update({
        where: { id: op.matchId },
        data: { homeScore: op.home, awayScore: op.away },
      });
      updated++;
    }
  }

  return { status: "ok", updated, cleared };
}

// =============================================================================
// Skupiny — pořadí + králové střelců (skutečné)
// =============================================================================

export type SaveGroupResultsResult =
  | {
      status: "ok";
      saved: number;
      skipped: string[];
      scorersSaved: number;
      scorersDeleted: number;
    }
  | { status: "unauth" }
  | { status: "forbidden" }
  | { status: "error"; message: string };

export async function saveGroupResultsAction(
  _prev: SaveGroupResultsResult | null,
  formData: FormData
): Promise<SaveGroupResultsResult> {
  try {
    return await saveGroupResults(formData);
  } catch (err) {
    console.error("[saveGroupResultsAction]", err);
    return { status: "error", message: ADMIN_SAVE_ERROR };
  }
}

async function saveGroupResults(
  formData: FormData
): Promise<SaveGroupResultsResult> {
  const session = await requireAdminSession();
  if (!session) return { status: "forbidden" };

  const teams = await db.team.findMany({
    where: { group: { not: null } },
    select: { code: true, group: true },
  });
  const codesByGroup = new Map<string, Set<string>>();
  for (const t of teams) {
    if (!t.group) continue;
    const set = codesByGroup.get(t.group) ?? new Set<string>();
    set.add(t.code);
    codesByGroup.set(t.group, set);
  }

  const skipped: string[] = [];
  let saved = 0;

  for (const group of GROUP_LETTERS) {
    const codes = [
      formData.get(`group_${group}_pos1`),
      formData.get(`group_${group}_pos2`),
      formData.get(`group_${group}_pos3`),
      formData.get(`group_${group}_pos4`),
    ].map((v) => (typeof v === "string" ? v.trim() : ""));

    if (codes.every((c) => c === "")) {
      // Smaž existující result, pokud jsme ho předtím uložili
      await db.groupRankingResult.deleteMany({
        where: { group: group as GroupLetter },
      });
      continue;
    }

    const valid =
      codes.every((c) => c !== "") &&
      new Set(codes).size === 4 &&
      codes.every((c) => codesByGroup.get(group)?.has(c));

    if (!valid) {
      skipped.push(group);
      continue;
    }

    await db.groupRankingResult.upsert({
      where: { group: group as GroupLetter },
      create: { group: group as GroupLetter, teamCodes: codes },
      update: { teamCodes: codes },
    });
    saved++;
  }

  // Králové střelců skupin → TournamentResult s TOP_SCORER_GROUP_<X>
  let scorersSaved = 0;
  let scorersDeleted = 0;
  for (const group of GROUP_LETTERS) {
    const raw = formData.get(`group_${group}_scorer`);
    const value = typeof raw === "string" ? raw.trim() : "";
    const type = `TOP_SCORER_GROUP_${group}`;
    if (value === "") {
      const res = await db.tournamentResult.deleteMany({ where: { type } });
      scorersDeleted += res.count;
      continue;
    }
    if (value.length > 80) continue;
    await db.tournamentResult.upsert({
      where: { type },
      create: { type, value },
      update: { value },
    });
    scorersSaved++;
  }

  return { status: "ok", saved, skipped, scorersSaved, scorersDeleted };
}

// =============================================================================
// Postupující do vyřazovacích kol (skutečné)
// =============================================================================

export type SaveKnockoutResultsResult =
  | { status: "ok"; saved: number; cleared: number }
  | { status: "unauth" }
  | { status: "forbidden" }
  | { status: "error"; message: string };

export async function saveKnockoutResultsAction(
  _prev: SaveKnockoutResultsResult | null,
  formData: FormData
): Promise<SaveKnockoutResultsResult> {
  try {
    return await saveKnockoutResults(formData);
  } catch (err) {
    console.error("[saveKnockoutResultsAction]", err);
    return { status: "error", message: ADMIN_SAVE_ERROR };
  }
}

async function saveKnockoutResults(
  formData: FormData
): Promise<SaveKnockoutResultsResult> {
  const session = await requireAdminSession();
  if (!session) return { status: "forbidden" };

  const validTeamCodes = new Set(
    (await db.team.findMany({ select: { code: true } })).map((t) => t.code)
  );

  let saved = 0;
  let cleared = 0;

  for (const round of KNOCKOUT_ADVANCERS_ROUNDS) {
    const raw = formData.getAll(`advancers_${round.key}`);
    const codes = Array.from(
      new Set(
        raw
          .filter((v): v is string => typeof v === "string")
          .map((v) => v.trim())
          .filter((v) => v !== "" && validTeamCodes.has(v))
      )
    ).slice(0, round.targetCount); // server-side limit, kdyby klient lhal

    if (codes.length === 0) {
      const res = await db.knockoutAdvancersResult.deleteMany({
        where: { stage: round.stage },
      });
      cleared += res.count;
      continue;
    }

    await db.knockoutAdvancersResult.upsert({
      where: { stage: round.stage },
      create: { stage: round.stage, teamCodes: codes },
      update: { teamCodes: codes },
    });
    saved++;
  }

  return { status: "ok", saved, cleared };
}

// =============================================================================
// Speciální výsledky — vítěz turnaje + král střelců turnaje
// =============================================================================

export type SaveSpecialResultsResult =
  | { status: "ok"; saved: number; deleted: number }
  | { status: "unauth" }
  | { status: "forbidden" }
  | { status: "error"; message: string };

const SPECIAL_RESULT_TYPES = [
  "TOURNAMENT_WINNER",
  "TOP_SCORER_TOURNAMENT",
] as const;

export async function saveSpecialResultsAction(
  _prev: SaveSpecialResultsResult | null,
  formData: FormData
): Promise<SaveSpecialResultsResult> {
  try {
    return await saveSpecialResults(formData);
  } catch (err) {
    console.error("[saveSpecialResultsAction]", err);
    return { status: "error", message: ADMIN_SAVE_ERROR };
  }
}

async function saveSpecialResults(
  formData: FormData
): Promise<SaveSpecialResultsResult> {
  const session = await requireAdminSession();
  if (!session) return { status: "forbidden" };

  const validTeamCodes = new Set(
    (await db.team.findMany({ select: { code: true } })).map((t) => t.code)
  );

  let saved = 0;
  let deleted = 0;

  for (const type of SPECIAL_RESULT_TYPES) {
    const raw = formData.get(`special_${type}`);
    const value = typeof raw === "string" ? raw.trim() : "";

    if (value === "") {
      const res = await db.tournamentResult.deleteMany({ where: { type } });
      deleted += res.count;
      continue;
    }

    if (type === "TOURNAMENT_WINNER") {
      if (!validTeamCodes.has(value)) continue;
    } else {
      if (value.length > 80) continue;
    }

    await db.tournamentResult.upsert({
      where: { type },
      create: { type, value },
      update: { value },
    });
    saved++;
  }

  return { status: "ok", saved, deleted };
}

// =============================================================================
// Pozvánkové maily
// =============================================================================

export type SendInvitationsResult =
  | {
      status: "ok";
      sent: number;
      failed: Array<{ email: string; error: string }>;
      invalid: string[];
    }
  | { status: "unauth" }
  | { status: "forbidden" }
  | { status: "error"; message: string };

const deadlineDateFormatter = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Prague",
});

/**
 * Pošle pozvánkové maily na zadané emailové adresy. Admin only.
 *
 * FormData:
 *   emails  = textarea, jeden email per řádek nebo oddělené čárkou/středníkem
 *   message = volitelný osobní vzkaz, který se vloží do mailu
 */
export async function sendInvitationsAction(
  _prev: SendInvitationsResult | null,
  formData: FormData
): Promise<SendInvitationsResult> {
  try {
    return await sendInvitations(formData);
  } catch (err) {
    console.error("[sendInvitationsAction]", err);
    return { status: "error", message: ADMIN_SAVE_ERROR };
  }
}

async function sendInvitations(
  formData: FormData
): Promise<SendInvitationsResult> {
  const session = await auth();
  if (!session?.user?.id) return { status: "unauth" };
  if (!session.user.isAdmin) return { status: "forbidden" };

  const rawEmails = (formData.get("emails") ?? "").toString();
  const personalMessage = (formData.get("message") ?? "").toString().trim();

  // Parser: split podle čárek, středníků, mezer, newline
  const parts = rawEmails
    .split(/[\n,;\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s !== "");
  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const e of parts) {
    if (seen.has(e)) continue;
    seen.add(e);
    if (isValidEmail(e)) valid.push(e);
    else invalid.push(e);
  }

  const senderName = session.user.name ?? "Admin tipovačky";
  const deadlineText = deadlineDateFormatter.format(tournament.deadline);

  const failed: Array<{ email: string; error: string }> = [];
  let sent = 0;

  for (const email of valid) {
    try {
      const { text, html } = buildInvitationContent({
        recipientEmail: email,
        senderName,
        personalMessage,
        deadlineText,
        tournamentName: tournament.name,
        appUrl: APP_URL,
      });
      await sendMail({
        to: email,
        subject: `Pozvánka do ${tournament.name}`,
        text,
        html,
      });
      sent++;
    } catch (err) {
      failed.push({
        email,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { status: "ok", sent, failed, invalid };
}

function buildInvitationContent(params: {
  recipientEmail: string;
  senderName: string;
  personalMessage: string;
  deadlineText: string;
  tournamentName: string;
  appUrl: string;
}): { text: string; html: string } {
  const { senderName, personalMessage, deadlineText, tournamentName, appUrl } =
    params;

  const intro = personalMessage
    ? personalMessage
    : `${senderName} tě zve do tipovačky na MS ve fotbale 2026 (USA, Kanada, Mexiko).`;

  const text = [
    `Ahoj!`,
    ``,
    intro,
    ``,
    `Jak začít:`,
    `1. Otevři ${appUrl}`,
    `2. Klikni „Přihlásit se" a zadej tvůj email (tento)`,
    `3. Dostaneš mail s odkazem, kliknutím se přihlásíš`,
    `4. Vyplň tipy do ${deadlineText}`,
    ``,
    `Tipuješ: výsledky všech zápasů, pořadí skupin, postupy, vítěze turnaje a krále střelců.`,
    `Po startu turnaje uvidíš tipy všech a průběžné pořadí.`,
    ``,
    `Hodně štěstí!`,
    `${senderName}`,
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="cs">
<head><meta charset="utf-8"><title>Pozvánka do ${tournamentName}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.5;color:#1e293b;max-width:560px;margin:0 auto;padding:24px;">
  <h1 style="margin:0 0 16px;font-size:22px;color:#0f172a;">${escapeHtml(tournamentName)}</h1>
  <p>Ahoj!</p>
  <p>${escapeHtml(intro)}</p>
  <h2 style="margin:24px 0 8px;font-size:16px;color:#0f172a;">Jak začít</h2>
  <ol style="padding-left:20px;">
    <li>Otevři <a href="${appUrl}" style="color:#0369a1;">${appUrl}</a></li>
    <li>Klikni <strong>Přihlásit se</strong> a zadej tento email</li>
    <li>Dostaneš mail s odkazem, kliknutím se přihlásíš</li>
    <li>Vyplň tipy do <strong>${escapeHtml(deadlineText)}</strong></li>
  </ol>
  <p style="margin-top:24px;">Tipuješ: výsledky všech zápasů, pořadí skupin, postupy, vítěze turnaje a krále střelců. Po startu turnaje uvidíš tipy všech a průběžné pořadí.</p>
  <div style="margin-top:24px;text-align:center;">
    <a href="${appUrl}" style="display:inline-block;background:#0f172a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Pojď tipovat</a>
  </div>
  <p style="margin-top:32px;color:#64748b;font-size:13px;">Hodně štěstí!<br>${escapeHtml(senderName)}</p>
</body></html>`;

  return { text, html };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// =============================================================================
// Vyřazovací pavouk — admin přidává konkrétní páry zápasů
// =============================================================================

export type SaveKnockoutFixturesResult =
  | {
      status: "ok";
      saved: number;
      skipped: number;
    }
  | { status: "unauth" }
  | { status: "forbidden" }
  | { status: "error"; message: string };

const KNOCKOUT_STAGES = [
  { stage: "ROUND_OF_32" as const, count: 16, prefix: "R32" },
  { stage: "ROUND_OF_16" as const, count: 8, prefix: "R16" },
  { stage: "QUARTER_FINAL" as const, count: 4, prefix: "QF" },
  { stage: "SEMI_FINAL" as const, count: 2, prefix: "SF" },
  { stage: "THIRD_PLACE" as const, count: 1, prefix: "BRONZ" },
  { stage: "FINAL" as const, count: 1, prefix: "F" },
] as const;

/**
 * Uloží/aktualizuje konkrétní zápasy vyřazovací fáze.
 *
 * FormData formát per zápas:
 *   match_<prefix>-<index>_home  = team code
 *   match_<prefix>-<index>_away  = team code
 *   match_<prefix>-<index>_date  = ISO datetime-local (např. "2026-06-28T21:00")
 *
 * Prefix = R32/R16/QF/SF/F, index = 1..N. Pokud má zápas všechna tři
 * pole vyplněná a oba team kódy jsou platné, upsertne Match. Pokud
 * jsou všechna pole prázdná, smaže existující záznam.
 */
export async function saveKnockoutFixturesAction(
  _prev: SaveKnockoutFixturesResult | null,
  formData: FormData
): Promise<SaveKnockoutFixturesResult> {
  try {
    return await saveKnockoutFixtures(formData);
  } catch (err) {
    console.error("[saveKnockoutFixturesAction]", err);
    return { status: "error", message: ADMIN_SAVE_ERROR };
  }
}

async function saveKnockoutFixtures(
  formData: FormData
): Promise<SaveKnockoutFixturesResult> {
  const session = await requireAdminSession();
  if (!session) return { status: "forbidden" };

  const validTeamCodes = new Set(
    (await db.team.findMany({ select: { code: true } })).map((t) => t.code)
  );

  // Načti existující knockout zápasy do mapy pro update vs. create rozhodnutí
  const existing = await db.match.findMany({
    where: {
      stage: { in: KNOCKOUT_STAGES.map((k) => k.stage) },
    },
    select: { matchKey: true, id: true },
  });
  const existingByKey = new Map(existing.map((m) => [m.matchKey, m.id]));

  let saved = 0;
  let skipped = 0;

  for (const round of KNOCKOUT_STAGES) {
    for (let i = 1; i <= round.count; i++) {
      const key = `${round.prefix}-${i}`;
      const homeRaw = formData.get(`match_${key}_home`);
      const awayRaw = formData.get(`match_${key}_away`);
      const dateRaw = formData.get(`match_${key}_date`);
      const home = typeof homeRaw === "string" ? homeRaw.trim() : "";
      const away = typeof awayRaw === "string" ? awayRaw.trim() : "";
      const dateStr = typeof dateRaw === "string" ? dateRaw.trim() : "";

      const allEmpty = home === "" && away === "" && dateStr === "";
      if (allEmpty) {
        // Smaž existující záznam, pokud byl (admin uklízí)
        const existId = existingByKey.get(key);
        if (existId) {
          await db.match.delete({ where: { id: existId } });
        }
        continue;
      }

      // Validace
      if (!validTeamCodes.has(home) || !validTeamCodes.has(away)) {
        skipped++;
        continue;
      }
      if (home === away) {
        skipped++;
        continue;
      }
      // Vstup je pražský nástěnný čas → převedeme na UTC instant.
      const dateUtc = pragueLocalToUtc(dateStr);
      if (!dateUtc || isNaN(dateUtc.getTime())) {
        skipped++;
        continue;
      }

      const homeTeam = await db.team.findUnique({
        where: { code: home },
        select: { id: true },
      });
      const awayTeam = await db.team.findUnique({
        where: { code: away },
        select: { id: true },
      });
      if (!homeTeam || !awayTeam) {
        skipped++;
        continue;
      }

      await db.match.upsert({
        where: { matchKey: key },
        create: {
          matchKey: key,
          stage: round.stage,
          dateUtc,
          homeTeamId: homeTeam.id,
          awayTeamId: awayTeam.id,
        },
        update: {
          dateUtc,
          homeTeamId: homeTeam.id,
          awayTeamId: awayTeam.id,
        },
      });
      saved++;
    }
  }

  // Nové dvojice se musí projevit všude, kde se vyřazovací zápasy čtou:
  // admin přehled, zadávání výsledků, pavouk i tipérské stránky.
  revalidatePath("/admin");
  revalidatePath("/admin/pavouk");
  revalidatePath("/admin/zapasy");
  revalidatePath("/formular");
  revalidatePath("/tipy");
  revalidatePath("/leaderboard/prehled");

  return { status: "ok", saved, skipped };
}

// =============================================================================
// Sjednocení jmen králů střelců — admin po turnaji označí, které varianty
// pravopisu se počítají jako shoda se skutečnou odpovědí.
// =============================================================================

export type SaveScorerAliasesResult =
  | { status: "ok"; saved: number }
  | { status: "unauth" }
  | { status: "forbidden" }
  | { status: "error"; message: string };

const TOP_SCORER_TYPE_RE = /^TOP_SCORER_(TOURNAMENT|GROUP_[A-L])$/;

/**
 * Pro každý TOP_SCORER_* typ uloží seznam přijatých aliasů (alternativních
 * pravopisů jména hráče). FormData formát:
 *   alias_<type> = jeden alias (může se opakovat více řádků se stejným klíčem)
 *
 * Aliasy, které po normalizaci splývají se samotnou skutečnou hodnotou,
 * se ignorují (počítají se automaticky). Duplicity (po normalizaci) se
 * deduplikují. Typy bez nastavené skutečné hodnoty se přeskočí.
 */
export async function saveScorerAliasesAction(
  _prev: SaveScorerAliasesResult | null,
  formData: FormData
): Promise<SaveScorerAliasesResult> {
  try {
    return await saveScorerAliases(formData);
  } catch (err) {
    console.error("[saveScorerAliasesAction]", err);
    return { status: "error", message: ADMIN_SAVE_ERROR };
  }
}

async function saveScorerAliases(
  formData: FormData
): Promise<SaveScorerAliasesResult> {
  const session = await requireAdminSession();
  if (!session) return { status: "forbidden" };

  const existing = await db.tournamentResult.findMany({
    where: { type: { startsWith: "TOP_SCORER_" } },
    select: { type: true, value: true },
  });

  let saved = 0;

  for (const r of existing) {
    if (!TOP_SCORER_TYPE_RE.test(r.type)) continue;
    const raw = formData.getAll(`alias_${r.type}`);
    const realN = normalizeName(r.value);
    const seenN = new Set<string>([realN]);
    const aliases: string[] = [];
    for (const v of raw) {
      if (typeof v !== "string") continue;
      const trimmed = v.trim();
      if (!trimmed || trimmed.length > 80) continue;
      const n = normalizeName(trimmed);
      if (n === "" || seenN.has(n)) continue;
      seenN.add(n);
      aliases.push(trimmed);
    }
    await db.tournamentResult.update({
      where: { type: r.type },
      data: { acceptedAliases: aliases },
    });
    saved++;
  }

  return { status: "ok", saved };
}

// =============================================================================
// Stav zaplacení uživatele — admin přepíná v /admin/kontrola
// =============================================================================

export type SetUserPaidResult =
  | { status: "ok"; paid: boolean }
  | { status: "unauth" }
  | { status: "forbidden" }
  | { status: "not-found" }
  | { status: "error"; message: string };

/**
 * Admin akce — nastaví příznak `paid` (zaplatil/nezaplatil) danému uživateli.
 */
export async function setUserPaidAction(
  userId: string,
  paid: boolean
): Promise<SetUserPaidResult> {
  try {
    const session = await requireAdminSession();
    if (!session) return { status: "forbidden" };

    const target = await db.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!target) return { status: "not-found" };

    await db.user.update({ where: { id: userId }, data: { paid } });

    revalidatePath("/admin/kontrola");
    return { status: "ok", paid };
  } catch (err) {
    console.error("[setUserPaidAction]", err);
    return { status: "error", message: ADMIN_SAVE_ERROR };
  }
}

// =============================================================================
// Smazání uživatelského účtu
// =============================================================================

export type DeleteUserResult =
  | { status: "ok"; deletedEmail: string }
  | { status: "unauth" }
  | { status: "forbidden" }
  | { status: "self" }
  | { status: "not-found" }
  | { status: "error"; message: string };

/**
 * Admin akce — kompletně smaže uživatele a všechna jeho data
 * (sessions, accounts, všechny tipy, audit log) přes onDelete: Cascade.
 * Použití: vyčištění duplicitního účtu.
 *
 * Ochrana: admin nesmí smazat sám sebe (vede k uzamčení rozhraní).
 */
export async function deleteUserAction(
  userId: string
): Promise<DeleteUserResult> {
  try {
    return await deleteUser(userId);
  } catch (err) {
    console.error("[deleteUserAction]", err);
    return { status: "error", message: ADMIN_SAVE_ERROR };
  }
}

async function deleteUser(userId: string): Promise<DeleteUserResult> {
  const session = await auth();
  if (!session?.user?.id) return { status: "unauth" };
  if (!session.user.isAdmin) return { status: "forbidden" };
  if (session.user.id === userId) return { status: "self" };

  const target = await db.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!target) return { status: "not-found" };

  await db.user.delete({ where: { id: userId } });

  revalidatePath("/admin");
  revalidatePath("/admin/historie");
  return { status: "ok", deletedEmail: target.email };
}

// =============================================================================
// Dotipování přes speciální odkaz (TipEditGrant)
// =============================================================================

export type CreateTipEditGrantResult =
  | { status: "ok"; url: string }
  | { status: "no-user" }
  | { status: "no-matches" }
  | { status: "bad-expiry" }
  | { status: "unauth" }
  | { status: "forbidden" }
  | { status: "error"; message: string };

/**
 * Admin vystaví povolení, aby uživatel mohl i po uzávěrce dotipovat vybrané
 * vyřazovací zápasy přes odkaz /dotipovani/<token>.
 *
 * FormData:
 *   userId    = id uživatele, kterému povolení patří
 *   matchIds  = (vícenásobně) Match.id povolených zápasů
 *   expiresAt = pražský nástěnný čas z <input type="datetime-local">
 */
export async function createTipEditGrantAction(
  _prev: CreateTipEditGrantResult | null,
  formData: FormData
): Promise<CreateTipEditGrantResult> {
  try {
    return await createTipEditGrant(formData);
  } catch (err) {
    console.error("[createTipEditGrantAction]", err);
    return { status: "error", message: ADMIN_SAVE_ERROR };
  }
}

async function createTipEditGrant(
  formData: FormData
): Promise<CreateTipEditGrantResult> {
  const session = await requireAdminSession();
  if (!session) return { status: "forbidden" };

  const userId = (formData.get("userId") ?? "").toString().trim();
  if (!userId) return { status: "no-user" };
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!user) return { status: "no-user" };

  // Expirace: pražský nástěnný čas → UTC, musí být v budoucnu.
  const expiresStr = (formData.get("expiresAt") ?? "").toString().trim();
  const expiresAt = pragueLocalToUtc(expiresStr);
  if (!expiresAt || isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
    return { status: "bad-expiry" };
  }

  // Povolit jen vyřazovací zápasy s vyplněnými oběma týmy.
  const requestedIds = formData
    .getAll("matchIds")
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter((v) => v !== "");
  const uniqueIds = Array.from(new Set(requestedIds));
  if (uniqueIds.length === 0) return { status: "no-matches" };

  const validMatches = await db.match.findMany({
    where: {
      id: { in: uniqueIds },
      stage: { not: "GROUP" },
      homeTeamId: { not: null },
      awayTeamId: { not: null },
    },
    select: { id: true },
  });
  const matchIds = validMatches.map((m) => m.id);
  if (matchIds.length === 0) return { status: "no-matches" };

  const token = randomBytes(24).toString("hex");
  await db.tipEditGrant.create({
    data: {
      token,
      userId,
      matchIds,
      expiresAt,
      createdByUserId: session.user.id,
    },
  });

  revalidatePath("/admin/dotipovani");
  return { status: "ok", url: `${APP_URL}/dotipovani/${token}` };
}

export type RevokeTipEditGrantResult =
  | { status: "ok" }
  | { status: "unauth" }
  | { status: "forbidden" }
  | { status: "error"; message: string };

/** Admin zruší (smaže) vystavené povolení. FormData: grantId. */
export async function revokeTipEditGrantAction(
  _prev: RevokeTipEditGrantResult | null,
  formData: FormData
): Promise<RevokeTipEditGrantResult> {
  try {
    const session = await requireAdminSession();
    if (!session) return { status: "forbidden" };
    const grantId = (formData.get("grantId") ?? "").toString().trim();
    if (grantId) {
      await db.tipEditGrant.deleteMany({ where: { id: grantId } });
    }
    revalidatePath("/admin/dotipovani");
    return { status: "ok" };
  } catch (err) {
    console.error("[revokeTipEditGrantAction]", err);
    return { status: "error", message: ADMIN_SAVE_ERROR };
  }
}
