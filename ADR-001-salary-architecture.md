# ADR-001: Lönearkitektur — historiska pass som oföränderliga fakta + säker Recompute

**Status:** Beslutad · **Datum:** 2026-07-11 · **Beslutsfattare:** teknisk ägare (Claude), godkänt av dd

## Kontext

Lön för ett pass beräknades tidigare inline och sparades (`base_amount`,
`ob_amount`, `total_amount`) på `shifts`-raden. Beräkningslogiken var kopierad
till 6 filer (jobb, kalender, importera, planering, pengar, installningar).

Två problem:
1. **Inaktuell data / fel princip:** när OB-regler eller timlön ändrades räknades
   gamla pass inte om — men det fanns inte heller något beslut om att de *inte
   skulle* räknas om. Beteendet var oavsiktligt, inte designat.
2. **Sex sanningskällor:** samma logik på 6 ställen glider isär över tid.

## Beslut

### 1. Historiska löner är oföränderliga fakta (temporal snapshot)
När ett pass beräknas sparas inte bara beloppen, utan en **snapshot av HELA
beräkningsgrunden** som gällde då: timlön, tillämpade regler, brutna timmar,
breakdown. En regeländring i framtiden rör ALDRIG ett redan beräknat pass.
Detta speglar hur riktiga lönesystem fungerar: en utbetald period är ett faktum.

Motivering: korrekthet över tid, reviderbarhet, och att redan utbetalda perioder
aldrig får förändras retroaktivt av en råkad regeländring.

### 2. En enda källa för att skapa/beräkna pass
All pass-skapande går genom EN funktion (`modules/salary/shift-service.ts`).
De 6 filerna anropar den istället för att duplicera logik. Beräkningen
(`compute.ts`/`ob.ts`) behålls — den är korrekt — men anropas bara härifrån.

### 3. Snapshotet lagras strukturerat, inte som lösa kolumner
Ny kolumn `shifts.pay_snapshot JSONB` bär hela grunden:
```json
{
  "engine_version": 1,
  "computed_at": "2026-07-11T...",
  "hourly_rate": 185.00,
  "shift_type": "regular",
  "hours_paid": 7.5,
  "base_amount": 1387.50,
  "ob_amount": 210.00,
  "total_amount": 1597.50,
  "breakdown": [{ "rule": "Natt (22–06)", "minutes": 120, "amount": 90 }],
  "rules_applied": ["natt", "lordag"]
}
```
De befintliga kolumnerna `base_amount/ob_amount/total_amount` behålls som
snabb-cache för summeringar (undviker JSONB-parsning i listvyer), men
snapshotet är sanningen om HUR de räknades fram.

### 4. Säker Recompute — avsiktlig, spårbar, godkänd
En `recompute`-funktion kan räkna om VALDA pass/perioder, men bara:
- på användarens uttryckliga begäran (aldrig automatiskt),
- ALDRIG på pass i en låst period (`pay_periods.is_locked` = utbetald lön),
- med en **audit-post** (`pay_recompute_log`) som sparar före/efter-belopp,
  orsak, tidpunkt — så användaren ser exakt vad som ändrades och varför.

Detta ger det du krävde: historiska löner ligger fast, men ett fel (t.ex.
felregistrerad timlön) kan rättas avsiktligt med full historik.

### 5. Engine-versionering
`pay_snapshot.engine_version` gör att vi kan förbättra lönemotorn i framtiden
utan att gamla snapshots blir tvetydiga — vi vet exakt vilken motor som räknade.

## Konsekvenser

**Positiva:** korrekt temporal data · en sanningskälla · reviderbar · redan
utbetald lön skyddad · motorn kan utvecklas utan att bryta historik · lätt att
underhålla (ändra på ETT ställe).

**Kostnad:** en migration (pay_snapshot + recompute-logg + is_locked-respekt) och
en refaktorering av 6 anropsställen till shift-service. Engångsarbete som betalar
sig varje gång lönelogik rörs framåt.

**Avvisat alternativ:** "räkna om vid varje läsning" (ren normalisering) —
förkastat eftersom det (a) skulle ändra historiska löner vid regeländring, vilket
strider mot kravet, och (b) kostar prestanda vid tusentals pass.

## Tillägg 2026-07-11: Bugg i lönemotorn upptäckt & fixad (engine v1)

Vid implementering kördes beräkningslogiken isolerat och avslöjade en verklig
bugg i `ob.ts minutesInWindow`: OB-regler som passerar midnatt (t.ex. natt
22:00–06:00) räknade INTE OB för den del av passet som låg efter midnatt.
Ett pass 22:00–02:00 gav 2h natt-OB istället för 4h — en underbetalning.

Orsak: fönstret 22:00–06:00 förlängdes till 22:00–30:00, men segmentet efter
midnatt (00:00–02:00) ligger före 22:00 och gav negativt/noll överlapp.

Fix: ett midnattsfönster behandlas nu som TVÅ intervall per dygn,
[ruleFrom,24:00) och [0,ruleTo), speglade ett dygn framåt för midnattssegment.
Verifierad med 8 testfall (`__tests__/ob-midnight.test.mjs`), alla gröna.

Konsekvens för snapshot-arkitekturen: detta är exakt varför `engine_version`
finns. Pass beräknade med den buggiga logiken bär `engine_version: 1` med fel
belopp. När migrationen körs bör användaren erbjudas en Recompute av
OLÅSTA perioder för att rätta historiska nattpass — låsta (utbetalda) perioder
lämnas orörda enligt grundprincipen. (Rekommendation: höj PAY_ENGINE_VERSION
till 2 när fixen är i produktion, så vi kan skilja för/efter i snapshots.)
