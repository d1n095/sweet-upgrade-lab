# LIFE OS — FAS 3: SCANNER (körklara Lovable-prompter)

> EN scanner för allt. Klassificera först, handla sen. Inga spökpass,
> inga dubbletter, lönespec matar tillbaka inställningar.
> Kör i ordning. Bygg detta EFTER att Arbete & Lön (Fas 1) fungerar,
> eftersom scannern skriver till work_shifts/work_profiles/ob_rules.
> Full detalj: spec Del 59 + 60. Kortregler: byggversionen avsnitt 7.

---

## PROMPT S0 — Databas för scan/import

```
[SCAN-DB] Lägg till tabeller och kolumner för scan & import. Rör inte
befintliga rader. RLS på alla nya tabeller (auth.uid() = user_id).

1. Skapa import_batches:
   id, user_id, document_id (FK documents), detected_type,
   type_confidence DECIMAL(4,3), confirmed_type, status DEFAULT 'classified'
   (classified/previewing/imported/reverted/failed),
   items_proposed INT, items_imported INT, items_skipped_dupe INT,
   created_at, reverted_at.

2. Skapa workplaces:
   id, user_id, work_profile_id (FK work_profiles), name, address,
   travel_minutes INT, notes, deleted_at.

3. Utöka work_shifts:
   ADD workplace_id UUID FK workplaces,
   ADD shift_category TEXT DEFAULT 'ordinary'
       (ordinary/extra/overtime/on_call/standby/inbeordrad),
   ADD import_batch_id UUID FK import_batches.

4. Utöka work_profiles:
   ADD pay_period_start_day INT   -- t.ex. 16 om löneperiod går 16→15.

5. Utöka ob_rules:
   ADD applies_to_category TEXT   -- NULL = gäller alla pass, annars t.ex. 'extra'.

RLS på import_batches + workplaces. Rapportera Klart:/Kvar:.
```

---

## PROMPT S1 — Upload + spara original FÖRST (ingen tolkning än)

```
[SCAN-001] Bygg upload-steget. Endast uppladdning + spara original.
Ingen OCR, ingen tolkning i detta steg.

1. En "Scanna / Ladda upp"-knapp (kamera på mobil, fil på desktop).
   Stöd bild, PDF (flersidig), screenshot.
2. Vid upload: spara filen direkt i documents (file_url, file_name,
   mime_type, document_type='other' tills vidare, ocr_status='pending').
   Originalet får ALDRIG ändras senare.
3. Visa filen i en förhandsvy och texten "Sparat. Analyserar…".
4. Skapa en import_batch kopplad till dokumentet (status='classified'
   sätts i nästa steg).

Ingen data extraheras, inga pass skapas. Rapportera Klart:/Kvar:.
```

**Testa:** ladda upp en bild → den syns i dokumentlistan → inget annat händer.

---

## PROMPT S2 — Klassificeraren (vad ÄR dokumentet?)

```
[SCAN-002] Bygg dokumentklassificeraren. Regelbaserad FÖRST (måste
fungera helt utan AI). Målet: avgöra dokumenttyp innan någon extraktion.

Typer: schema, payslip, receipt, invoice, contract, warranty, insurance,
id_document, other.

1. Kör OCR (Tesseract.js) på dokumentet för att få råtext. Håll OCR-motorn
   bakom ett litet interface så den kan bytas senare — klassificeraren ska
   inte veta vilken OCR som användes.

2. Regelbaserad klassificering på råtexten. Exempelsignaler:
   - schema: flera framtida datum + tider i mönster (07-16) + veckodagar +
     passkoder (D/K/N/J) + rubrik "schema/turlista"; SAKNAR kronor-belopp.
   - payslip: ett periodintervall bakåt + ord "lönespecifikation/bruttolön/
     nettolön/skatteavdrag/OB-tillägg/semesterersättning" + kronor i kolumner
     + anställningsnummer/org.nr.
   - receipt: ett datum + en totalsumma + moms + butiksnamn.
   Räkna signaler → ge type_confidence 0-1.

3. Spara detected_type + type_confidence på import_batch.

4. VISA resultatet: "Detta ser ut som: [typ] ([X]%). Stämmer det?"
   med knappar: Ja + en dropdown för att välja rätt typ om fel.
   Om type_confidence < 0.6: visa INGEN gissning som självklar — fråga
   öppet "Vad är detta?" och lista typerna.

5. När användaren bekräftar: sätt confirmed_type + uppdatera
   documents.document_type. Spara ev. korrigering (fel gissning) lokalt
   som lärdom — skicka INGEN privat data någonstans.

VIKTIGT: ingenting importeras än. Detta steg producerar bara en bekräftad
typ. Rapportera Klart:/Kvar: och beskriv hur jag testar med (a) ett schema,
(b) en lönespec, (c) ett kvitto.
```

**Testa:** ladda upp tre olika dokument → var och en klassas rätt, och ett
otydligt dokument ger en öppen fråga i stället för fel gissning.

---

## PROMPT S3 — Schema-import: förslag, inte skapade pass + dubblettskydd

```
[SCAN-003] När confirmed_type = 'schema', bygg schema-importen.
Kritiskt: skapa FÖRSLAG, inte pass. Inga pass i work_shifts förrän
användaren godkänner.

1. Extrahera rader ur schemat: {datum, start, slut, passkod, arbetsplats?}.
   Confidence per fält: 95%+ auto, 70-95% förifyllt "bekräfta",
   under 70% tomt/manuellt. Hantera flersidigt och pass över midnatt
   (crosses_midnight=true, sätt end_date) — splittra ALDRIG till två pass.

2. Visa en förhandsgranskning: varje rad som ett REDIGERBART föreslaget
   pass. Låt användaren välja work_profile (och workplace om känd) för
   passen. Gulmarkera osäkra fält. Rader systemet är osäkra på ("pass eller
   anteckning?") markeras separat och importeras inte utan bekräftelse.

3. SPÖKPASS-SKYDD: om dokumentet ser ut som en screenshot av appens egen
   schema-/tidvy (t.ex. innehåller appens egna UI-texter/rubriker), visa en
   tydlig varning: "Detta ser ut som en bild av din egen schemavy — inte ett
   nytt schema. Vill du verkligen importera det som nya pass?" och kräv extra
   bekräftelse.

4. DUBBLETTKONTROLL (obligatorisk) innan pass skapas: för varje föreslaget
   pass, sök befintliga work_shifts med samma work_profile_id + samma date +
   överlappande tid (start/slut inom 30 min). Vid träff, visa båda sida vid
   sida och låt användaren välja: Hoppa över / Ersätt / Behåll båda.
   Räkna items_skipped_dupe.

5. Först när användaren trycker "Skapa X pass": skriv till work_shifts med
   source='ocr' och import_batch_id satt. Sätt batch-status='imported' och
   fyll items_imported.

6. Sjuk/VAB/semester i schemat importeras med rätt status, inte som vanligt
   arbetat pass. Delade pass samma dag (06-10 + 16-20) slås INTE ihop.

Rapportera Klart:/Kvar: och beskriv testflödet inkl. dubblett-scenariot och
spökpass-varningen.
```

**Testa:** importera ett schema → pass föreslås, inte skapas. Importera
samma schema igen → alla fångas som dubbletter. Ladda upp en screenshot av
den egna schemavyn → spökpass-varning triggas.

---

## PROMPT S4 — Ångra import (hela batchen)

```
[SCAN-004] Gör varje import ångringsbar.

1. På en importerad batch: knapp "Ångra hela importen". Soft-deletar alla
   work_shifts med det import_batch_id och sätter batch-status='reverted',
   reverted_at=now().
2. Visa importhistorik: lista alla import_batches med typ, datum, antal
   importerade/hoppade, status. Varje rad öppningsbar.

Rapportera Klart:/Kvar:.
```

**Testa:** importera ett schema → ångra → alla de passen försvinner (soft
delete), inga andra pass påverkas.

---

## PROMPT S5 — Lönespec: läs data OCH föreslå inställningar

```
[SCAN-005] När confirmed_type = 'payslip', bygg lönespec-importen. Den ska
göra TVÅ saker: (a) spara lönespecen, (b) FÖRESLÅ inställningar ur den.
Allt som förslag — ändra aldrig regler eller skapa profiler automatiskt.

1. Extrahera fält: period_start, period_end, arbetsgivare, bruttolön,
   nettolön, skatt, OB-belopp per nivå (om läsbart), jour, semesterersättning,
   övertid, total_hours, timlön. Confidence per fält som vanligt.

2. Spara i payslips (koppla document_id till originalet, ocr_raw = råtext,
   verified_at = null tills användaren bekräftat fälten).

3. FÖRESLÅ inställningar (visa som en lista användaren kan bocka i, inget
   auto-sparas):
   - Om arbetsgivaren inte matchar någon work_profile: "Skapa ny arbetsprofil
     för [arbetsgivare]?" eller "Koppla till befintlig: […]".
   - Om timlön/skattekolumn/semesterprocent avlästs: "Uppdatera arbetsprofilen
     med dessa värden?"
   - Om OB-nivåer avlästs (t.ex. natt-OB 45 kr/h 22-06): "Spara som ob_rule
     för den här profilen?" Visa varje föreslagen regel redigerbart.
   Bara det användaren bockar i sparas, efter tryck på "Spara valda".

4. Efter import: jämför lönespecens siffror mot appens egen löneuträkning
   för samma period, post för post. Differenser visas som "möjlig avvikelse"
   / "behöver kontrolleras" — ALDRIG "arbetsgivaren gjorde fel". Detta matar
   Payday Center (spec Del 57).

5. Hantera: löneperiod ≠ kalendermånad (använd work_profiles.pay_period_start_day),
   och retroaktiva rader (en lönerad kan gälla en tidigare periods pass —
   låt användaren koppla den dit).

Rapportera Klart:/Kvar: och beskriv testflödet: scanna en lönespec →
föreslagna inställningar → jämförelse mot appens uträkning.
```

**Testa:** scanna en lönespec från en ny arbetsgivare → systemet föreslår
profil + OB-regler (sparar inget tyst) → efter godkännande jämförs den mot
appens uträkning och avvikelser flaggas neutralt.

---

## PROMPT S6 — Arbetsplats + extra-/övertidsregler

```
[SCAN-006] Färdigställ arbetsplats- och extrapass-hanteringen.

1. UI för att lägga till flera workplaces per work_profile (namn, adress,
   restid). Pass kan kopplas till en workplace.
2. På ett pass: välj shift_category (ordinary/extra/overtime/on_call/
   standby/inbeordrad). Vid import försök gissa kategori men låt användaren
   ändra.
3. I ob_rules-UI: en regel kan sättas att gälla bara en shift_category via
   applies_to_category (t.ex. "extra-pass: OB från timme 1"). Lönemotorn
   måste visa vilken kategori + vilka regler som gav vilket belopp.

Rapportera Klart:/Kvar:.
```

**Testa:** skapa ett extra-pass → andra OB-regler slår in än på ett vanligt
pass, och uträkningen visar vilka regler som användes.

---

## NÄR FAS 3 ÄR KLAR

```
Sammanfatta Scan & Import-status. Bekräfta att: EN scanner hanterar alla
typer, klassificering sker före import, scheman blir förslag (inte pass),
dubbletter fångas, hela batchen kan ångras, spökpass-skyddet fungerar,
lönespec föreslår inställningar utan att auto-sätta, och lönespec jämförs
mot appens uträkning. Lista TODO. Skapa inga nya features.
```

Efter detta är hela kärnkedjan hel: **schema → pass → uträkning ↔ lönespec
→ korrigerade regler → bättre uträkning**. Det är produktens hjärta.
