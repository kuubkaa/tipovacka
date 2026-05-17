# Tipovačka MS 2026

Webová aplikace pro tipování zápasů Mistrovství světa ve fotbale 2026 (USA, Kanada, Mexiko) s kamarády.

Aplikace je postavená tak, aby šla použít i pro další ročníky — viz [Změna na nový ročník](#zmena-na-novy-rocnik).

---

## Jak to funguje

1. Tipér otevře stránku, klikne na **Vyplnit tipy** a vyplní svoje tipy.
2. Do uzávěrky (start turnaje) **nikdo nevidí cizí tipy**.
3. Po uzávěrce se zveřejní tipy všech a začne se bodovat podle toho, jak blízko byl tip správnému výsledku.

---

## Lokální spuštění

Potřebuješ Node.js 20+ a npm.

```bash
npm install
npm run dev
```

Otevři [http://localhost:3000](http://localhost:3000).

### Užitečné příkazy

| Příkaz | Co dělá |
|--------|---------|
| `npm run dev` | Spustí dev server s hot-reloadem |
| `npm run build` | Vytvoří produkční build (zkontroluje TypeScript) |
| `npm run start` | Spustí produkční build lokálně |
| `npm run lint` | ESLint kontrola |

---

## Nasazení na Vercel

1. **Pushni kód na GitHub** (vytvoř nový repozitář a `git push`).
2. Jdi na [vercel.com/new](https://vercel.com/new), přihlas se přes GitHub.
3. Vyber svůj repozitář → klikni **Import**.
4. Vercel automaticky detekuje Next.js. Žádná konfigurace není potřeba.
5. Klikni **Deploy**. Za ~1 minutu je aplikace online.

Každý další `git push` na hlavní branch (`main`) se automaticky nasadí jako produkce.

**Až přidáme databázi** (další iterace), bude potřeba ve Vercel projektu přidat **Vercel Postgres** (nebo Neon) a nastavit env proměnnou `DATABASE_URL`. Postup doplníme.

---

## Změna na nový ročník

Pro nový turnaj (např. ME 2028) stačí změnit **3 věci**:

1. **`src/config/tournament.ts`** — název, podtitul, rok, deadline, kontakt
2. **`public/logo.svg`** — vyměň za nové logo (zachovej název souboru)
3. *(volitelné)* **`src/app/page.tsx`** — barvy gradientu na landing page (řádek `bg-gradient-to-br from-indigo-950 via-slate-900 to-emerald-950`)

Vše ostatní (tipovací logika, formuláře, bodování) zůstane stejné.

---

## Struktura projektu

Detailní popis a interní pravidla najdeš v [CLAUDE.md](./CLAUDE.md).

```
src/
├── app/             # Stránky (App Router)
├── components/ui/   # shadcn/ui komponenty
├── config/          # ⭐ tournament.ts — zde se mění branding turnaje
└── lib/             # Utility
```

---

## Tech stack

- **Next.js 16** + **React 19** + **TypeScript** (App Router, Turbopack)
- **Tailwind CSS v4** + **shadcn/ui** (base-ui)
- **lucide-react** ikony
- Připraveno pro **Vercel Postgres** + **Prisma** + magic-link auth (v dalších iteracích)
