# INTEGRATIONSLOGG — vilka riktiga filer ändrats

Spårar exakt vilka BEFINTLIGA filer som ändrats och vilka NYA som lagts till,
så allt kan föras in och verifieras stegvis i Lovable/Supabase.

## KRITISKT POST-MIGRATION-STEG
Efter att UPGRADE_01..06 körts i Supabase MÅSTE typerna regenereras:
`supabase gen types typescript --project-id <id> > src/integrations/supabase/types.ts`
Därefter: ersätt `db` (core/db.ts) med den typade `supabase` i session.ts,
shift-service.ts och finance-service.ts, och radera core/db.ts.
Tills dess är `db` en medveten, dokumenterad brygga (se core/db.ts).

## Byggpaket 1 — Kontext + shift-service-integration

### Nya filer
- `src/modules/core/session.ts` — löser användare + aktiv ägarskapskontext (solo-first)
- `src/modules/core/session-context.tsx` — React-provider + useSession() + IfMultiContext
- `src/modules/core/datetime.ts` — tidszons-säker tid (Stockholm↔UTC, DST) [tidigare pass]
- `src/modules/core/db.ts` — TEMPORÄR otypad brygga tills types regenererats
- `src/modules/core/i18n/format.ts` — locale-medveten formatering [tidigare pass]
- `src/modules/salary/shift-service.ts` — central pass-service [tidigare pass, nu ctx-medveten]

### Ändrade befintliga filer
- `src/routes/__root.tsx` — la till <SessionProvider> runt appen + import
- `src/components/action-sheet/flows/shift-flow.tsx` — ERSATTE inline pass-skapande
  (buggig tidszonslogik + rå insert + inline compute) med createShifts() från servicen.
  Nu: tidszons-säkert, skriver owner_context_id + pay_snapshot, timeline i synk,
  soft-delete respekteras i krock-koll, locale-formaterade felmeddelanden.

### Effekt
- Pass som skapas via snabbflödet är nu korrekta (midnatt/DST/OB), ägs av kontext,
  bär oföränderlig lönesnapshot, och håller timeline uppdaterad — allt via EN väg.

## Byggpaket 3 — Ekonomi på transaktionsmodellen

### Nya filer
- `src/modules/finance/finance-service.ts` — enda källan för penningrörelser
  (inkomst+utgift via transactions, valuta, kategori-uppslag, timeline, nettosummering)

### Ändrade befintliga filer
- `src/components/action-sheet/flows/expense-flow.tsx` — skriver nu transaction
  (direction='out') via servicen istället för till `expenses`-tabellen.
- `src/routes/_app/pengar.tsx` — läser transactions (out) via servicen, skapar via
  servicen, soft-deletar via servicen. Fixade även inline-tidszonsbugg
  (new Date(`${date}T12:00`) → stockholmToUtc). Timeline hanteras i servicen.

### Effekt
- Ekonomin kör helt på den enhetliga modellen. Inkomst har nu ett hem, valuta stöds,
  kategorier är data, öre-belopp i SEK normaliseras. `expenses`-tabellen är nu
  legacy (läses ej av UI) — migreras av UPGRADE_05, kan droppas senare.

### Kvar (nästa)
- Kategori-UI: byt namn-baserad kategori mot category_id-väljare (kräver kategori-lista).
- Inkomst-flöde: bygg "Lägg inkomst"-vy (quick-add-knappen finns, target saknas).

## Byggpaket 4 — Scanner + alla kvarvarande skrivvägar migrerade

### Nya filer
- `src/components/action-sheet/flows/income-flow.tsx` — inkomst-flöde (stänger
  No-Mockups-lucka: "Lägg inkomst"-knappen fungerar nu end-to-end).

### Ändrade befintliga filer
- `src/routes/_app/importera.tsx` — scanner-import går via createShifts, skapar
  import_batch (ångringsbart), kontext-ägd, soft-delete vid replace.
- `src/routes/_app/kalender.tsx` — pass OCH utgift via services (+ tidszonsfix).
- `src/routes/_app/planering.tsx` — båda vecko-/preset-insert via createShifts,
  soft-delete vid replace via db-bryggan.
- `src/components/action-sheet/ActionSheet.tsx` — kopplar in IncomeFlow.

### RESULTAT — inga parallella skrivlösningar kvar
- `grep from("shifts").insert` → INGA (alla pass via shift-service)
- `grep from("expenses").insert` → INGA (all ekonomi via finance-service)
- Alla pass-skrivvägar är nu tidszons-säkra, kontext-ägda, snapshot-bärande.
- Alla ekonomi-skrivvägar går via transaktionsmodellen.

### Kvar för scanner-INTELLIGENS (eget paket, ej skrivväg)
- Dokumentklassificering (schema/lönespec/kvitto) — SCAN-CLASS-001
- Spökpass-skydd (self-screenshot) — SCAN-GHOST-001
- Lönespec-scanning + återkoppling — SCAN-PAYSLIP-001/FEEDBACK-001
- Spara originalfil i documents — SCAN-ORIG-001
- Ångra-import-UI (batch finns nu i data) — SCAN-UNDO-001

## Byggpaket 5 — Event-system (nervsystem, ADR-005)

### Nya filer
- `src/modules/core/events.ts` — emit()/emitMany(), enda vägen att skapa händelser
- `docs/ADR-005-event-system.md` — beslut + framtidsplan (Automation/Rules/Notification)

### Ändrade
- `supabase/migrations/UPGRADE_07_event_system.sql` — timeline generaliserad:
  owner_context_id, actor_user_id, processed_at (event-bus-redo), dedupe_key
  (idempotens), event_types-referens, kontext-RLS.
- `finance-service.ts`, `shift-service.ts` — skriver via emit/emitMany, ej direkt.
- `kalender.tsx` — not via emit; INKOMST via finance-service (BUGGFIX: kalender-
  inkomst skrevs tidigare bara till timeline och syntes ej i ekonomin).

### Effekt + framtid
- Alla händelser går genom ETT lager. Nya domäner (hälsa, resa, fordon) kan emitta
  utan migration (kind = fritext). processed_at gör att en framtida Automation/
  Rules/Notification-motor kan reagera på events UTAN att timeline byggs om.
- Buggfix: kalender-inkomst hamnar nu i transaktionsmodellen.

## Byggpaket 6 — Generell dokument- & importmotor (ADR-006)

### Nya filer
- `docs/ADR-006-document-engine.md` — beslut + pipeline (klassificera→route)
- `src/modules/scan/classify.ts` — dokumentklassificerare (regelbaserad, 7/7 testad)
  + spökpass-hint (looksLikeOwnAppScreenshot) + typeLabel
- `src/modules/scan/import-router.ts` — router: schema→shift-service,
  receipt/invoice→finance-service, payslip→payslips, arkiv→documents.
  startBatch/finishBatch/revertBatch (ångra hel import)
- `src/modules/scan/ocr-client.ts` — fileContentHash (dubblettskydd), withRetry
  (backoff), classifyOcrError (tydlig felhantering + manuell fallback-flagga)
- `src/routes/_app/installningar.import-historik.tsx` — importhistorik + ångra-UI

### Ändrade
- `supabase/migrations/UPGRADE_08_document_engine.sql` — content_hash (fil-
  dubblettskydd), ocr_result, import_batches.owner_context_id
- `src/routes/_app/importera.tsx` — spökpass-skydd (ghostSuspected: alla rader
  redan befintliga → varning innan spar)
- `src/modules/finance/finance-service.ts` — metadataBatchId (för import-ångra)

### Effekt
- Klassificeraren skiljer schema/lönespec/kvitto/faktura/avtal/garanti/försäkring
  regelbaserat (7/7 i test), utan AI. Ny typ = extraktor+route, inte ny scanner.
- All import-skrivning går via services + emit. Import = batch = ångringsbar.
- Fil-dubblett (content_hash) + rad-dubblett (befintlig konfliktkoll) + spökpass.
- Robust OCR-lager: retry/backoff, tydliga fel, manuell fallback.

### Ärlig status — vad som återstår i scanner-paketet
- Extraktorer för payslip/receipt/invoice (nu finns bara schema-OCR):
  klassificering + router + historik + ghost-skydd är byggt, men de TYPSPECIFIKA
  AI-extraktorerna för icke-schema-dokument är inte skrivna än. Schema fungerar
  fullt ut (befintlig OCR). Nästa: payslip-extraktor (matar settings-förslag).
- Originalfil-uppladdning till documents+storage vid scan (SCAN-ORIG-001):
  hash-funktionen finns, upload-steget ska kopplas in.
