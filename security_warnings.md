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
