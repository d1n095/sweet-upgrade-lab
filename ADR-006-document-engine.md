# ADR-006: Generell dokument- & importmotor (inte ett schemaflöde)

**Status:** Beslutad · **Datum:** 2026-07-11 · **Beslutsfattare:** teknisk ägare (Claude)

## Kontext

Nuvarande scanner (`schedule-ocr.functions.ts`) är hårt schema-specifik: en
enda AI-prompt som antar att bilden ÄR ett schema. Den kan inte skilja
dokumenttyper, saknar klassificering, spökpass-skydd, retry/fallback, och
skriver pass med gammalt mönster.

Kravet (din vision): EN generell dokument- och importmotor som klassificerar
vad ett dokument är och skickar rätt data till rätt modul — schema→shift-service,
lönespec→settings/payslips, kvitto→finance-service, avtal/garanti→documents.

## Beslut — pipeline i tydliga steg, generell över dokumenttyper

```
1. UPLOAD        → spara ORIGINAL i documents (privat storage) FÖRST
2. CLASSIFY      → vad ÄR detta? (regelbaserat + AI) → typ + confidence
3. VERIFY TYPE   → visa gissad typ, användaren bekräftar/korrigerar
4. EXTRACT       → typspecifik extraktor, confidence PER FÄLT
5. GHOST-GUARD   → är detta en bild av appens egen vy? → varna
6. DEDUPE        → dokument-dubblett (hash) + rad-dubbletter (pass/transaktion)
7. PREVIEW       → förhandsgranskning, osäkra fält markerade, manuell verifiering
8. ROUTE         → skicka godkänd data till rätt modul:
                     schema   → shift-service.createShifts (import_batch)
                     payslip  → payslips + föreslå settings
                     receipt  → finance-service.createTransaction
                     invoice  → finance-service (kommande räkning)
                     contract/warranty/insurance/other → documents (arkiv)
9. EMIT + BATCH  → import_batch (ångra), events via emit(), original bevarat
```

### Generell design — inte specialbyggd
- **Klassificeraren** är EN funktion, oberoende av OCR-leverantör.
- **Extraktorer** är utbytbara per typ (samma motor, olika prompt/schema).
  Ny dokumenttyp = ny extraktor + route, INTE en ny scanner.
- **Routern** mappar typ → målmodul. All skrivning går via befintliga
  services (shift/finance/documents) + emit — ingen ny direkt-DB-väg.

### Spökpass-skydd (SCAN-GHOST-001)
Två signaler: (a) klassificeraren får en hint om bilden innehåller appens egna
UI-texter/rubriker → flagga "ser ut som en skärmdump av din egen vy";
(b) om alla rader matchar befintliga pass exakt → sannolik self-import → varna.

### Dokument-dubblett (skydd mot samma fil två gånger)
Vid upload beräknas en `content_hash` (SHA-256 av filen). Finns samma hash i
`documents` för kontexten → varna "detta dokument är redan importerat".

### Confidence + manuell verifiering
Per fält: ≥0.95 auto, 0.7–0.95 förifyllt "bekräfta", <0.7 tomt/manuellt.
Osäkra rader importeras ALDRIG utan användarens bekräftelse.

### Fallback, retry, felhantering
- AI-anrop: 2 retries med backoff vid 429/5xx.
- 402 (slut på krediter) / total miss → tydligt fel + MANUELL väg (användaren
  kan mata in raderna för hand; motorn dör aldrig tyst).
- Timeout-skydd.

### Idempotens
- Dokument: content_hash unikt per kontext.
- Rader: dedupe-nyckel (profil+datum+tid för pass; belopp+datum+merchant för tx).
- Import-batch kopplar allt → hela importen ångras samlat.

## Datamodell (tillägg)

```sql
documents: ADD content_hash TEXT, ocr_result JSONB   -- fil-hash + rå OCR
import_batches: (finns) — detected_type/confirmed_type/status/counts/reverted_at
```

## Konsekvenser

**Positiva:** en motor för alla dokument · ny typ = extraktor+route (billigt) ·
allt via services+emit (ingen ny DB-väg) · original bevarat · ångra · dubblett-
skydd på både fil- och radnivå · robust mot AI-fel.

**Kostnad:** större byggpaket, men ersätter det sköra schemaflödet helt.

## Avvisat
- Behålla separata scanners per typ: förkastat — det är motsatsen till generellt
  och skulle bli 6 parallella flöden att underhålla.
