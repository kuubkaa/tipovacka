# E2E testy (Playwright)

Automatické testy, které spustí aplikaci v prohlížeči a ověří, že klíčové
věci fungují: veřejné stránky, přihlášení, vyplnění profilu, **uložení tipů**,
pořadí a přístup do administrace.

## Než je poprvé spustíš

1. **Stáhni env proměnné z Vercelu** (potřeba `DATABASE_URL`, `AUTH_SECRET`, …):
   ```bash
   npx vercel env pull .env.local
   ```
2. **Nainstaluj prohlížeč pro testy** (stačí jednou):
   ```bash
   npx playwright install chromium
   ```

## Spuštění

```bash
npm run test:e2e        # spustí všechny testy (headless)
npm run test:e2e:ui     # interaktivní okno – vidíš, co testy dělají
npm run test:e2e:report # otevře HTML report posledního běhu
```

Testy si samy nastartují dev server na portu **3100** (aby nekolidoval
s `npm run dev` na 3000) a po doběhnutí ho zase shodí.

## Jak je to bezpečné vůči datům

- Každý test si vytvoří **vlastní dočasný účet** (e-mail `e2e-…@example.test`,
  jméno s předponou `[E2E]`) a po sobě ho **smaže**.
- Testy **nikdy nemění** sdílená data — týmy, zápasy, ani cizí uživatele.
- Admin testy jen ověřují přístup, **nezapisují** žádné výsledky.
- Kdyby nějaký test spadl, závěrečný úklid smaže všechny zbylé `e2e-` účty.

## Co se testuje

| Soubor | Ověřuje |
|--------|---------|
| `public.spec.ts` | Úvod, pravidla a přihlašovací formulář se načtou |
| `auth.spec.ts` | Přesměrování nepřihlášených + odeslání magic linku |
| `profil.spec.ts` | Uživatel bez jména → /profil, uložení jména |
| `tipy.spec.ts` | Uložení tipu na zápas a jeho přetrvání po reloadu |
| `leaderboard.spec.ts` | Přihlášený vidí pořadí |
| `admin.spec.ts` | Neadmin nemá přístup, admin ano |

Pomocné soubory jsou v `e2e/helpers/` (napojení na DB a přihlašovací fixture).
