# GRANSKNINGSLOGG — löpande kritisk granskning (CTO)

Fynd under kontinuerlig granskning. Varje post: problem, allvar, status, var.

## Lösta

| # | Fynd | Allvar | Lösning | Var |
|---|------|--------|---------|-----|
| A1 | Migration ej idempotent (triggers utan DROP) | Hög | DROP TRIGGER före alla CREATE | UPGRADE_01 v2 |
| A2 | Dokument-storage saknade bucket + policies (publik risk) | Hög | Privat bucket + per-user storage-policies | UPGRADE_01 v2 |
| A3 | Textfält utan validering | Medel | CHECK-constraints på alla enum-lika fält | UPGRADE_01 v2 |
| A4 | Lön beräknad + fryst, 6 källor, inaktuell vid regeländring | Hög | Snapshot-arkitektur + shift-service (enda källa) + recompute | ADR-001, UPGRADE_02 |
| A5 | Midnatts-OB-bugg: nattpass efter midnatt fick ingen OB | Hög (fel lön) | minutesInWindow fixad, 8 testfall gröna | ob.ts, __tests__ |
| A6 | Utbetald lön kunde ändras retroaktivt | Hög | DB-trigger blockerar ändring i låst period | UPGRADE_02 |
| A7 | Ägarskap låst till user_id → ingen delning/tenant möjlig | Kritisk | Kontext-baserad ägarskapsmodell | ADR-002, UPGRADE_03/04 |
| A8 | Inkomst lovas i UI men saknar tabell (No Mockups-brott) | Hög | Enhetlig transactions-modell (in/out) | ADR-003, UPGRADE_05 |
| A9 | Ingen valuta — allt implicit SEK | Medel | currency + fx_rate + amount_sek | UPGRADE_05 |
| A10 | Kategorier hårdkodade som enum (ej data) | Medel | categories-tabell per kontext | UPGRADE_05 |
| A12 | Pass-skapande centraliserat till shift-service (ersatte inline i shift-flow) | Hög | createShifts() enda väg | shift-flow.tsx |
| A13 | Kontext-ägarskap inkopplat i kod (solo-first) | Kritisk | session.ts + provider + __root | session*.ts |
| A11 | Tidszonsbugg: new Date(`${date}T${time}`) → fel absolut tid | Hög (fel lön/dag) | core/datetime.ts, Stockholm→UTC, DST-testad | datetime.ts, __tests__ |

## Öppna (prioriterade, ej lösta än)

| # | Fynd | Allvar | Plan |
|---|------|--------|------|
| B1 | Inget DB-constraint att shift.ends_at > starts_at | Medel | Lägg CHECK (nästa migration) |
| B2 | Inget DB-dubblettskydd för pass (bara i kod) | Medel | EXCLUDE-constraint med tstzrange övervägs |
| B3 | OCR: ingen retry/fallback/kostnadstak, dör om AI nere | Medel | Fallback till manuell + retry-logik (scanner-lager) |
| B4 | Kalender-route: 21 supabase-anrop, möjlig N+1 | Låg-Medel | Profilera, slå ihop queries |
| B5 | CORE-SEC-002: service-role i klient ej verifierad | Hög | Måste granskas före lansering |
| B6 | Övergångs-RLS tillåter user_id ELLER kontext | Låg | Städa bort user_id-gren när all skrivning satt owner_context_id |
