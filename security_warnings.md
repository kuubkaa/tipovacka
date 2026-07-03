# Security warnings

Seznam vědomých bezpečnostních kompromisů a rizik. Aktualizuj při každé nové funkci.

## Dotipovací odkaz (`TipEditGrant`, `/dotipovani/<token>`)

- **Riziko:** Veřejná stránka `/dotipovani/<token>` nevyžaduje přihlášení — token
  v URL sám autorizuje zápis tipů za daného uživatele. Kdokoli, kdo odkaz získá
  (přeposlání, únik), může tipy toho uživatele vyplnit nebo přepsat až do
  expirace.
- **Proč to tak je:** Uzavřená skupina kamarádů, cílem je co nejmenší tření
  (admin pošle odkaz přes WhatsApp, člověk hned dotipuje bez loginu).
- **Zmírnění:**
  - Token je náhodný a nehádatelný (`crypto.randomBytes(24)` = 48 hex znaků).
  - Odkaz má povinnou expiraci (admin ji nastavuje při generování).
  - Admin může odkaz kdykoli zrušit v `/admin/dotipovani`.
  - Zápis je omezen jen na zápasy vybrané adminem (`matchIds`); jiné zápasy ani
    typy tipů přes odkaz nejdou.
  - Skóre se validuje (celé číslo 0–20), stejně jako v běžném formuláři.
  - Každá změna se zapisuje do `TipChangeLog` (dohledatelnost sporů).
- **Pokud by skupina vyrostla / zvýšila se citlivost:** přepnout odkaz na variantu
  vyžadující přihlášení (magic link jako daný uživatel) — návrh už to počítá jako
  alternativu.

## Auto-login na Vercel preview (`/dev-login`, `PREVIEW_AUTOLOGIN_*`)

- **Riziko:** Preview deployment branche `dev` čte stejné env proměnné jako
  produkce, tedy se připojuje ke **stejné produkční databázi**. Auto-login jako
  admin (`jakubmilotinsky@gmail.com`) na veřejné preview URL by tak znamenal
  plný admin přístup k ostrým datům pro kohokoli, kdo tu URL najde.
- **Proč to tak je:** Pohodlí při vývoji — nechceme se na preview pořád
  přihlašovat magic linkem.
- **Zmírnění:**
  - Auto-login se aktivuje JEN na Vercel preview (`VERCEL_ENV === "preview"`),
    nikdy v produkci ani lokálně (tam běží samostatný `DEV_AUTOLOGIN_EMAIL`).
  - Spustí se AŽ když prohlížeč nese cookie `preview_autologin` shodnou s tajným
    klíčem `PREVIEW_AUTOLOGIN_KEY` (náhodný, 48 hex znaků). Cizí návštěvník
    preview URL cookie nemá → vidí normální login.
  - Cookie nastaví jen route `/dev-login?key=<klíč>`, která sama funguje pouze na
    preview a jinde vrací 404. Cookie je `httpOnly`, `secure`, `sameSite=lax`.
  - Klíč i email jsou env proměnné nastavené **jen v Preview scope** na Vercelu
    (ne v Production).
- **Zbytkové riziko:** Kdo získá tajný klíč, získá admin na produkční data přes
  preview. Klíč drž v tajnosti; při úniku ho přegeneruj (změna env var na
  Vercelu okamžitě zneplatní staré cookie).
- **Čistší varianta do budoucna:** oddělená testovací DB pro preview, pak by
  auto-login nebyl rizikový vůbec.
