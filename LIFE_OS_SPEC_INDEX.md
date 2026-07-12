# LIFE OS — SPEC-INDEX & DUBBLETTKARTA

> Masterspecen (MY_MONEY_MASTER_SPEC_V3.md) är 6310 rader / 64 delar. Den
> växte fram genom att många dokument klistrades in vid olika tillfällen, så
> flera teman är utspridda över flera delar. Detta index säger VAR sanningen
> för varje tema finns (den auktoritativa delen) och vilka delar som bara är
> stödmaterial. Vid konflikt: den auktoritativa delen + byggversionen vinner.
>
> **Praktiskt:** du behöver inte läsa hela specen. Byggversionen
> (LIFE_OS_BYGGVERSION.md) är den dagliga sanningen. Detta index är för att
> hitta djupdetaljer i masterspecen när de behövs.

---

## SÅ HÄR ÄR SPECEN ORGANISERAD (15 teman, inte 64 lösa delar)

| # | Tema | AUKTORITATIV del | Stöd/överlappande delar |
|---|------|------------------|--------------------------|
| 1 | Vision & filosofi | Del 1–3 | Del 12, 48 (lagarna) |
| 2 | De 20 lagarna | **Del 48** | Del 3, 22 |
| 3 | UX & designsystem | **Del 44** | Del 4, 5, 33, 45 |
| 4 | Navigation & IA | **Del 61** | Del 13, 34 |
| 5 | Objektmodell | **Del 39** | Del 8, 43, 63 |
| 6 | Kärnmotorer (motorkarta) | **Del 63** | Del 7, 56 |
| 7 | Databas & SQL | **Del 43** | Del 24, 39, 38 |
| 8 | Arbete & Lön | **Del 14.2 + 62** | Del 26, 40, 57 |
| 9 | Scanner & import | **Del 59** | Del 14.3, 60 |
| 10 | Ekonomi | Del 14.6 | Del 32, 53 |
| 11 | Dokument & vault | Del 14.8 | Del 39, 59 |
| 12 | Säkerhet | **Del 49** | Del 17, 24 |
| 13 | Lovable-arbetssätt | **Del 37** | Del 20, 25, 47 |
| 14 | Krav-ID & ordning | **Del 50–52** | Del 16 |
| 15 | Multi-tenant (SaaS) | **Del 64** | — |

---

## GRANSKNINGS-/LUCKDELARNA (läs som EN grupp)

Specen har tio delar som alla är "vi hittade fler luckor"-genomgångar:
**Del 15, 32, 33, 36, 38, 40, 41, 42, 53, 60.**

De är värdefulla men överlappar mycket. De innehåller i praktiken samma
sorts sak: edge cases, saknade valideringsregler, verklighetskrockar. När du
bygger en modul, sök i dessa efter modulens namn (t.ex. "lön", "pass",
"OCR") för att fånga edge cases — men förvänta dig upprepning mellan dem.

**Viktigast av dem:** Del 40 (pro-granskning), Del 42 (kraschar i verkligheten),
Del 53 (real life gaps). De andra är mestadels delmängder.

---

## KÄNDA ÖVERLAPP (medvetet kvarlämnade, inte buggar)

### Tabellnamn — lösta konflikter (viktigt för bygget)

Granskningen hittade och löste dessa. Använd ALLTID vänsterkolumnen:

- **`ob_rules`** (INTE `pay_rules`) — alla löneregler. Kanoniskt beslut: **Del 62B**.
  `pay_profiles`/`employers`/`pay_rules` i äldre delar är utgångna namn.
- **`work_profiles`** (INTE `pay_profiles`) — arbetsprofil/anställning.
- **`crosses_midnight`** (INTE `passes_midnight`) — fältet på work_shifts.

### Tabeller som LÅTER lika men är olika (behåll båda)

- **`break_rules`** = regeln ("30 min efter 5h"), kopplad till `work_profiles`.
- **`shift_breaks`** = en faktisk rast på ett faktiskt pass, kopplad till `work_shifts`.
  Olika saker, båda behövs. Blanda inte ihop.

### Teman som står på flera ställen Det är OK — men den **feta** delen är den
som gäller vid konflikt:

- **Designsystem:** Del 5 (tokens) + **Del 44** (komplett). Använd Del 44.
- **Objektmodell:** Del 8 (lista) + **Del 39** (modell) + Del 43 (SQL). Del 39 styr.
- **Säkerhet:** Del 17 (översikt) + **Del 49** (threat model) + Del 24 (DB-RLS).
- **Lovable-regler:** Del 20 + 25 + **Del 37** (constitution). Del 37 styr.
- **Krav-ID:** Del 16 + 50 + **Del 51** + 52. Del 51 är systemet, 52 är tillägg.
- **Motorer:** Del 7 (tidig lista) + **Del 63** (kanonisk karta). Del 63 styr.

---

## OM DU VILL STÄDA SPECEN PÅ RIKTIGT (framtida val, ej gjort än)

En full omskrivning till 15 rena delar skulle halvera radantalet och ta bort
all upprepning — MEN det är ett stort ingrepp med risk att tappa detaljer.
Rekommendation: gör det INTE nu. Bygg appen först. Byggversionen +
detta index räcker för att arbeta utan förvirring. Spara omskrivningen till
efter att alpha fungerar, om den ens behövs då.

Om/när det görs, målstrukturen är de 15 teman ovan, i den ordningen, med
gransknings­delarna hopslagna till EN "Edge Cases & Kända Risker"-del.
