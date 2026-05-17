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
- **Databáze:** Vercel Postgres (Neon) — **plánováno, ještě nenasazeno**
- **ORM:** Prisma — **plánováno, ještě nenasazeno**
- **Auth:** Magic link přes email (Auth.js / NextAuth v5) — **plánováno**
- **Hosting:** Vercel
- **Kontejnerizace:** Žádná. Pracujeme přímo na hostu (`npm run dev`).

## Pravidla

### Prostředí
- NIKDY needituj `.env` — používej pouze `.env.local`
- Spouštění: `npm run dev` (dev), `npm run build` (produkční build), `npm run lint`
- Po každé instalaci balíčku: `npm install <balíček>` (restart dev serveru ručně)
- Po změně Prisma schema (až bude): `npx prisma generate` + `npx prisma migrate dev`

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
- E2E testy: Playwright (přidáme, až bude formulář funkční)
- Testovací data prefixuj `[E2E]` + timestamp

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
1. **Auth (magic link)** — login přes email, session
2. **DB + Prisma schema** — Vercel Postgres, modely `User`, `Match`, `Tip`, `SpecialTip`
3. **Tipovací formulář** — zápasy ze základní skupiny + speciální tipy (král střelců, vítěz)
4. **Admin rozhraní** — zadávání reálných výsledků
5. **Bodování + leaderboard** — automatický výpočet po zadání výsledku
6. **Vyřazovací pavouk** — odemkne se po skončení skupin (dynamicky podle postupů)

## Nuance projektu
- Tipy se počítají podle blízkosti k reálnému výsledku (přesný výsledek > správný vítěz a rozdíl > jen správný vítěz).
- Pavouk vyřazovací části se zveřejní/aktivuje až po posledním zápase skupin, protože dvojice se generují dynamicky.
- Speciální tipy (král střelců turnaje, celkový vítěz) se zadávají jednorázově před turnajem.

## Rozhodnutí
- **2026-05-17:** Stack zvolen Next.js + Vercel Postgres + Prisma + Magic link auth. Bez Dockeru — celé běží nativně, Vercel ho stejně nepoužívá.
- **2026-05-17:** Reusabilita řešena přes `src/config/tournament.ts` (jeden soubor = jedna pravda o brandingu).

## Údržba tohoto souboru
- Aktualizuj po každé strukturální změně, novém pravidlu nebo rozhodnutí
- Maximální stručnost — detaily patří do kódu, ne sem
- Smaž zastaralé info, nepřidávej duplicity
