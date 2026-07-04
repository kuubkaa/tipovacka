# CLAUDE.md

Živý dokument. Průběžně aktualizuj, udržuj krátký a přehledný.

## Projekt
- **Název:** Tipovačka MS 2026
- **Popis:** Webová aplikace pro tipování zápasů a doprovodných tipů na Mistrovství světa ve fotbale 2026 (USA, Kanada, Mexiko) s kamarády.
- **Cíl:** Jednoduché prostředí, kde si tipéři vyplní tipy, do deadlinu nikdo nevidí cizí tipy, po deadlinu se vše zveřejní a začne bodování podle blízkosti správnému výsledku.
- **Cílová skupina:** Malá uzavřená skupina kamarádů (řády jednotek až desítek lidí).
- **Reusabilita:** Aplikace má být znovupoužitelná pro další ročníky (MS, ME). Všechen branding (název, logo, deadline) je v `src/config/tournament.ts` + `public/logo.svg` + barevné proměnné v `src/app/globals.css`.
- **Jazyky UI:** Čeština (jediný jazyk).

## Uživatel
- **Skill level:** Začátečník
  - Neptej se na technické detaily, rozhoduj sám a vysvětluj jednoduše.
  - Při větších rozhodnutích nabídni 2–3 varianty s krátkým doporučením.
  - Komunikace v chatu: česky. Kód (názvy, komentáře, commity): anglicky.

## Stack
- **Framework:** Next.js 16 (App Router) + TypeScript + React 19 + Turbopack
- **UI:** Tailwind CSS v4 + shadcn/ui (base-ui primitives) + lucide-react ikony
- **Font:** Geist Sans / Geist Mono
- **Databáze:** Vercel Postgres (Neon) — ✅ nasazená (region eu-central-1, free tier)
- **ORM:** Prisma 7 + `@prisma/adapter-pg` (driver adapter, ne Rust engine)
- **Auth:** Magic link přes email — ✅ Auth.js v5 (beta) + Prisma adapter + **Nodemailer / Gmail SMTP** (sender `jakubmilotinsky@gmail.com` přes App Password). Resend balík je v deps, ale nepoužívá se.
- **Hosting:** Vercel
- **Kontejnerizace:** Žádná. Pracujeme přímo na hostu (`npm run dev`).

## Pravidla

### Prostředí
- NIKDY needituj `.env` — používej pouze `.env.local`
- Spouštění: `npm run dev` (dev), `npm run build` (produkční build), `npm run lint`
- Po každé instalaci balíčku: `npm install <balíček>` (restart dev serveru ručně)
- **DB scripts** (všechny čtou `.env.local` přes `dotenv-cli`):
  - `npm run db:migrate -- --name <jmeno>` — vytvoří + aplikuje novou migraci (dev)
  - `npm run db:deploy` — aplikuje hotové migrace (CI / produkce)
  - `npm run db:studio` — otevře Prisma Studio (web UI nad DB)
  - `npm run db:push` — sync schématu bez migrace (jen pro rychlé prototypování)
  - `npm run db:generate` — regeneruje Prisma klienta
- **Env vars pro DB** (Vercel/Neon je nastavuje automaticky): `DATABASE_URL` (pooled, runtime), `DATABASE_URL_UNPOOLED` (direct, migrace)
- **Refresh env vars z Vercelu** (po změně na Vercelu): `npx vercel env pull .env.local`

### Git a commity
- Před každým commitem a pushem se zeptej uživatele na potvrzení
- Commit zprávy: anglicky, stručné, popisné (`feat: add tip form`, `fix: deadline timezone`)
- Pracovní branch: `dev`. Nikdy nepushuj přímo na `main` bez potvrzení (main = produkce na Vercelu).

### Produkční mód
Pokud `NODE_ENV=production`:
- Žádné destruktivní DB operace (DROP, TRUNCATE, DELETE bez WHERE, seed, reset)
- Vždy upozorni uživatele, že běží produkce
- Migrace jen s explicitním potvrzením

### Knihovny a verze
- Vždy používej nejnovější stabilní verze
- Před instalací ověř aktuální verzi na npm
- Nepoužívej deprecated balíčky

### Testy
- E2E testy: Playwright — ✅ hotovo (2026-05-29). 12 testů v `e2e/`, viz `e2e/README.md`.
  - Spuštění: `npm run test:e2e` (potřebuje `.env.local` — `npx vercel env pull .env.local`).
  - Server běží na portu 3100 (vlastní, nekoliduje s `npm run dev`).
  - Přihlášení v testech: programově přes DB session + cookie `authjs.session-token` (fixture `loginAs`).
  - `AUTH_SECRET` ve `.env.local` přidán lokálně (Vercel ho má jen v produkčním prostředí).
- Testovací data prefixuj `[E2E]` + timestamp. Každý test si tvoří vlastní `e2e-…@example.test` účet a po sobě uklízí; sdílená data (týmy, zápasy) se nemění.

### Role a přístupy (plán)
- **Tipér** (běžný uživatel): vyplňuje a edituje vlastní tipy do deadlinu. Po deadlinu jen čte.
- **Admin**: zadává správné výsledky po skončení zápasů, může upravit deadline.
- **Registrace**: přes email (magic link). Bez hesla.
- **Při implementaci nové funkce se VŽDY zeptej:** kdo to vidí / kdo upravuje.

### Mazací akce
- Všechny mazací akce musí mít potvrzovací dialog (AlertDialog s varováním)

### Bezpečnost
- U každé nové funkce kontroluj auth, validaci vstupů, SQL injection, XSS, CSRF
- Potenciální rizika zapisuj do `security_warnings.md` v rootu (vznikne, až bude potřeba)

### Grafika a UI
- Branding turnaje je v `src/config/tournament.ts` (název, logo, deadline)
- Barvy: shadcn/ui CSS proměnné v `src/app/globals.css` (`--primary`, `--background`, …)
- Landing page má vlastní temný gradient (indigo→slate→emerald) jako "tournament hero"
- Pro nový ročník stačí: přepsat `tournament.ts`, vyměnit `/public/logo.svg`, případně upravit barvy gradientu v `src/app/page.tsx`

### Vyhledávání
- Pokud si nejsi jistý aktuální verzí, syntaxí nebo best practice — vyhledej na internetu, neopírej se o zastaralé znalosti

## Struktura projektu

```
/
├── public/
│   ├── logo.svg                  # Logo turnaje (vyměnitelné za nový ročník)
│   └── *.svg                     # default Next.js ilustrace (lze smazat)
├── src/
│   ├── app/
│   │   ├── layout.tsx            # Root layout, lang="cs", metadata z tournament configu
│   │   ├── page.tsx              # Landing — hero s CTA "Vyplnit tipy"
│   │   ├── globals.css           # Tailwind + shadcn theme proměnné
│   │   ├── formular/page.tsx     # Stub — sem přijde tipovací formulář
│   │   ├── tipy/page.tsx         # Stub — přehled tipů všech (po deadlinu)
│   │   └── pravidla/page.tsx     # Stub — pravidla bodování
│   ├── components/
│   │   ├── ui/                   # shadcn komponenty (button, card, input, label)
│   │   └── page-shell.tsx        # Společný layout vnitřních stránek
│   ├── config/
│   │   └── tournament.ts         # ⭐ ZDE se mění název / logo / deadline pro nový ročník
│   └── lib/
│       └── utils.ts              # shadcn `cn()` helper
├── components.json               # shadcn config
├── next.config.ts
├── package.json
└── tsconfig.json
```

## Plán dalších iterací
1. ✅ ~~DB + Prisma schema~~ — hotovo (2026-05-17)
2. ✅ ~~Auth (magic link)~~ — hotovo (2026-05-18). Auth.js v5 + Gmail SMTP, funguje na produkci s libovolným příjemcem.
3. ✅ ~~Seed týmů a zápasů MS 2026~~ — hotovo (2026-05-18). 48 týmů, 12 skupin, 72 zápasů.
4. ✅ ~~Tipovací formulář (skupinová fáze)~~ — hotovo (2026-05-18). /formular ukládá tipy na 72 zápasů.
5. ✅ ~~Profil uživatele~~ — hotovo (2026-05-20). Uživatel bez jména se přesměruje na `/profil` (guard `requireName` + redirect z `/` a `/formular`); po uložení se vrátí zpět.
6. **Pořadí skupin** — tipy na 1.–4. místo v každé skupině (nový model `GroupRankingTip`)
7. **Speciální tipy** — král střelců (skupinový + turnaj), vítěz turnaje (model `SpecialTip` už existuje)
8. **Admin rozhraní** — zadávání reálných výsledků
9. **Bodování + leaderboard** — automatický výpočet po zadání výsledku
10. **Vyřazovací pavouk** — odemkne se po skončení skupin (dynamicky podle postupů)

## Nuance projektu
- Tipy se počítají podle blízkosti k reálnému výsledku (přesný výsledek > správný vítěz a rozdíl > jen správný vítěz).
- Pavouk vyřazovací části se zveřejní/aktivuje až po posledním zápase skupin, protože dvojice se generují dynamicky.
- Speciální tipy (král střelců turnaje, celkový vítěz) se zadávají jednorázově před turnajem.

## Rozhodnutí
- **2026-05-17:** Stack zvolen Next.js + Vercel Postgres + Prisma + Magic link auth. Bez Dockeru — celé běží nativně, Vercel ho stejně nepoužívá.
- **2026-05-17:** Reusabilita řešena přes `src/config/tournament.ts` (jeden soubor = jedna pravda o brandingu).
- **2026-05-17:** Prisma 7 — connection string je v `prisma.config.ts` (ne v schema.prisma) + runtime jde přes `@prisma/adapter-pg` (driver adapter). Důvod: Prisma 7 odstranila `url` z datasource bloku a oddělila migrace od runtime.
- **2026-05-17:** Neon DB bez Neon Auth — chceme vlastní Auth.js, ne vendor-lock-in. Lze kdykoliv zapnout, pokud bychom změnili názor.
- **2026-05-18:** Auth.js v5 (beta) zvolen místo Neon Auth. Env vars na Vercelu: `AUTH_SECRET`, `AUTH_RESEND_KEY` (Auth.js si je najde automaticky podle konvence `AUTH_<PROVIDER>_KEY`). V dev modu se magic link loguje do terminálu — Resend se používá jen v produkci.
- **2026-05-18:** Resend sender zatím `onboarding@resend.dev` (free tier bez vlastní domény). Pošle se jen na email registrovaný v Resendu. Pro pozvánky cizím adresám musíme ověřit vlastní doménu.
- **2026-05-18:** Místo ověření domény jsme přepnuli na **Gmail SMTP** (Nodemailer + App Password). Posílá z `jakubmilotinsky@gmail.com` na jakoukoli adresu, 500/den limit, žádná doména potřeba. Env vars na Vercelu: `EMAIL_SERVER_HOST/PORT/USER/PASSWORD` + `EMAIL_FROM`.
- **2026-05-19:** **Král střelců — volný text + admin sjednocení.** Tipér zadá jméno hráče volně (žádný dropdown ze soupisek). Po turnaji admin v rozhraní označí, které textové varianty se počítají jako shoda se skutečným králem střelců (normalizace + ruční rozhodnutí o sporných případech jako „Ronaldo"). Důvod: soupisky nejsou v době tipování ještě venku a import ~1200 hráčů je overkill pro pár tipů. Týká se i krále střelců po skupinách.
- **2026-06-09:** **Uzávěrka tipů po fázích = výkop prvního zápasu fáze.** Zrušeno per-zápas tipování (dřív šlo tipovat každý zápas až do jeho výkopu) i per-zápas odkrývání cizích tipů. Nově: skupinové zápasy + pořadí skupin + speciály + postupy se uzavřou výkopem úvodního zápasu turnaje (`tournament.deadline`) a v ten okamžik se zároveň najednou zveřejní tipy všech. Vyřazovací zápasy (pavouk) se tipují po skupinách a každé kolo se uzamkne výkopem svého prvního zápasu (per-stage `min(dateUtc)`). Dotčené: `formular/actions.ts` (saveTips zamyká podle prvního výkopu fáze přes `groupBy`), `formular/page.tsx` (skupiny = `globalDeadlinePassed`, KO = první výkop kola), `tipy/page.tsx` + `leaderboard/prehled/page.tsx` (odstraněn per-zápas reveal — obě stránky stejně zobrazují jen skupinové zápasy), texty v `NAVOD-pro-ucastniky.md`, `whatsapp-zprava.txt`, admin `pavouk/page.tsx`.
- **2026-06-30:** **Dotipovací odkaz pro zapomnětlivce.** Admin v `/admin/dotipovani` vybere uživatele, zaškrtne konkrétní vyřazovací zápasy a nastaví expiraci → vygeneruje token-only odkaz `/dotipovani/<token>` (bez loginu). Přes něj může dotyčný dotipovat povolené zápasy i po uzávěrce fáze. Nový model `TipEditGrant` (token, userId, matchIds[], expiresAt, usedAt). Zápis obchází stage-lock, ale jen pro `matchIds` z povolení, validuje skóre 0–20 a loguje do `TipChangeLog`. Admin odkaz vidí v seznamu a může ho zrušit (smazat). Vědomý kompromis bez loginu — viz `security_warnings.md`. Soubory: `dotipovani/actions.ts` + `dotipovani/[token]/page.tsx`, `admin/dotipovani/page.tsx`, `grant-form.tsx`, `grant-tips-form.tsx`, `admin/actions.ts` (create/revoke).
- **2026-07-03:** **Auto-login na Vercel preview za tajným klíčem.** Aby se na preview (branch `dev`) nemuselo přihlašovat magic linkem, `auth()` umí vrátit session admina, ale JEN na `VERCEL_ENV=preview` a JEN když prohlížeč nese cookie `preview_autologin` shodnou s `PREVIEW_AUTOLOGIN_KEY`. Cookie nastaví route `/dev-login?key=<klíč>` (na preview; jinde 404). Env vars (jen Preview scope na Vercelu): `PREVIEW_AUTOLOGIN_EMAIL`, `PREVIEW_AUTOLOGIN_KEY`. Lokální dev má vlastní `DEV_AUTOLOGIN_EMAIL` (`.env.local`). Preview sdílí produkční DB → viz `security_warnings.md`. Soubory: `src/auth.ts`, `src/app/dev-login/route.ts`.
- **2026-07-03:** **Responzivní šířka pro PC — méně scrollu, více sloupců.** Do té doby byl obsah všude natvrdo v `max-w-3xl` (úzký sloupec i na velkém monitoru). Nově sdílený token `src/lib/layout.ts` → `PAGE_WIDTH = "max-w-3xl lg:max-w-6xl"` (mobil beze změny, PC ~1150px). Použit na kontejnerech (`SiteHeader`, `PageShell`, formulář, tipy, leaderboard, admin stránky). Opakující se karty/sekce jdou na PC do gridu (`lg:grid-cols-2`/`xl:grid-cols-3`, vždy `items-start`): `TipsForm`, `GroupRankingsForm`, `SpecialTipsForm` (vítěz+střelec vedle sebe), `MatchResultsForm` (zápasy do mřížky přes `gap-px` vlasové linky), `tipy/page` (zápasy + karty), `pravidla`, admin `group-results-form`/`special-results-form`/`scorer-aliases-form`. Leaderboard na PC (`lg:`) ukazuje i rozpad bodů po sloupcích (dřív jen tisk). Úzké nechány: malé formuláře (pozvánky, dotipování) a `leaderboard/prehled` (už `max-w-7xl` scroll matice).
- **2026-05-29:** **Fix loginu — odolné mazání session.** Auth.js Prisma adaptér při přihlášení mazal starou session z DB; pokud uživatel měl starou/expirovanou session cookie bez záznamu v DB, `prisma.session.delete()` vyhodilo P2025 a celý login spadl (chyba „Configuration"). V `src/auth.ts` obalujeme `deleteSession` a P2025 ignorujeme. Reprodukováno i opraveno lokálně (curl flow proti produkční DB).
- **2026-07-04:** **Ruční uzávěrky tipů (přebití automatiky).** Dřív se uzávěrky jen počítaly (skupiny = `tournament.deadline`, KO kola = výkop prvního zápasu kola). Nově admin v `/admin/uzaverky` nastaví vlastní datum a čas — pro celé kolo, jednotlivý zápas, pořadí skupin nebo speciály. Nový model `DeadlineOverride` (`scope` @id: `STAGE:<Stage>` | `MATCH:<id>` | `GROUP_RANKINGS` | `SPECIALS`, `deadline`). Priorita při rozhodnutí o zámku zápasu: **override zápasu > override kola > automatika**. Veškerá logika centralizovaná v `src/lib/deadlines.ts` (`loadDeadlineContext` + lehké `isGroupPhaseClosed`/`groupPhaseDeadline`/`isRankingsClosed`/`isSpecialsClosed`) — nahradila roztroušené `isDeadlinePassed()` a per-fázové `groupBy(min dateUtc)`. Uzávěrka skupinové fáze zároveň spouští zveřejnění cizích tipů (reveal v `tipy/`, `leaderboard/prehled`, banner na `/`, `layout`) — jede přes stejnou efektivní uzávěrku. „Zavřít teď" = server nastaví `deadline = now` (op `now`, bez řešení TZ). Dotipovací odkaz (`TipEditGrant`) je nedotčený — token bypass jede dál. Vidí a mění jen admin. Soubory: `src/lib/deadlines.ts`, `admin/uzaverky/page.tsx`, `components/deadlines-form.tsx`, `admin/actions.ts` (`setDeadlineOverrideAction`), napojení ve `formular/actions.ts` + `formular/page.tsx` + reveal stránkách.

## Údržba tohoto souboru
- Aktualizuj po každé strukturální změně, novém pravidlu nebo rozhodnutí
- Maximální stručnost — detaily patří do kódu, ne sem
- Smaž zastaralé info, nepřidávej duplicity
