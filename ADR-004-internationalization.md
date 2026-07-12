# ADR-004: Internationalisering (i18n) & lokalisering (l10n) i grunden

**Status:** Beslutad · **Datum:** 2026-07-11 · **Beslutsfattare:** teknisk ägare (Claude)

## Kontext

Appen är byggd svensk-först: ~168 hårdkodade svenska strängar, `sv-SE`/`SEK`
hårdkodat i `format.ts`, "kr" skrivet direkt i komponenter. Detta är helt okej
för dagens privatperson, MEN allt som är region-/språk-/landsberoende (valuta,
datum, tid, tal, skatt, måttenheter, helgdagar, veckostart) blir mycket dyrt att
retrofit:a när det sitter spritt i hela koden.

Mandatet: bygg internationellt från grunden utan att göra om systemet senare,
men KOMPROMISSA ALDRIG med den svenska privatpersonens enkla upplevelse.

## Beslut — bygg seams nu, översätt senare

Vi skiljer på tre saker och gör olika för varje:

### 1. FORMATERING (gör klart nu — billigt, hög nytta)
Allt tal/valuta/datum/tid går genom EN locale-medveten modul (`core/i18n/format`)
som tar användarens locale + valuta, aldrig hårdkodat. `Intl.*` finns redan —
vi parametriserar det bara. Svensk användare får identisk output (`sv-SE`/`SEK`),
men en användare med annan inställning får rätt format automatiskt.

### 2. LOKALISERINGSDATA (strukturera nu — region-beroende regler som DATA)
Saker som skiljer per land byggs som data, inte kod:
- **Valuta:** redan löst (ADR-003: currency + fx_rate + amount_sek).
- **Skatteregler:** `tax_rules` som data per region (inte hårdkodad svensk skatt).
- **Helgdagar:** redan `holiday_rules` som data — utöka med region.
- **Veckostart, datumformat, måttenheter:** härleds från locale.
- **OB/löneregler:** redan data (ob_rules) — inte landslåsta.

### 3. UI-TEXT (förbered nu, översätt vid behov — dyrast, lägst brådska)
Vi inför en `t()`-funktion och en nyckelstruktur, men fyller den med svenska nu.
Att flytta 168 strängar till nycklar görs stegvis. Poängen: infrastrukturen finns,
så översättning blir att lägga till en språkfil — inte att bygga om.

## Datamodell — användarens locale-preferenser

Locale bor i `user_defaults` (finns) via nycklar, med vettiga defaults:
```
locale.language   -> 'sv'          (sv/en/...)
locale.region     -> 'SE'          (SE/NO/FI/US/...)
locale.currency   -> 'SEK'         (standardvaluta för nya transaktioner)
locale.timezone   -> 'Europe/Stockholm'
locale.date_format-> härleds från region om ej satt
locale.week_start -> härleds (SE=måndag, US=söndag)
locale.units      -> 'metric'      (metric/imperial)
```
Kontext (hushåll/företag) kan ha egen locale som ärvs av medlemmar men överrids
av personlig preferens. Solo-användaren rör aldrig detta — allt defaultar till
svenskt.

## Princip: locale ≠ tvång

En svensk som jobbar i Norge kan ha `language=sv` men transaktioner i `NOK`.
Språk, region, valuta och tidszon är OBEROENDE axlar — aldrig buntade. Det är så
verkligt internationella appar bygger (och var många misslyckas).

## Konsekvenser

**Positiva:** formatering rätt från dag ett · region-regler som data · nästa
språk = en fil, inte ombyggnad · svensk upplevelse orörd · stödjer gränsarbetare
· redo för expansion utan kärnändring.

**Kostnad:** en format-modul + gradvis strängextraktion. Formateringen görs nu;
strängöversättning skjuts men är förberedd.

## Avvisat
- Full översättning nu: förkastat — stort arbete, noll nytta för dagens
  målgrupp, och infrastruktur räcker för att inte måla in sig i ett hörn.
- i18n-bibliotek (i18next) direkt: övervägs senare; för nu en tunn egen `t()`
  räcker och håller bundlen liten (Lag 19: Performance).
