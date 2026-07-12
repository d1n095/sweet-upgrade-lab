# LIFE OS / MY MONEY MASTER — BYGGVERSION (KONDENSERAD)

> **Detta dokument läses vid VARJE Lovable-prompt.** Det är den korta,
> byggbara versionen av masterspec:en (5610 rader). Vid tveksamhet:
> följ de 20 lagarna nedan. De vinner alltid.
>
> Full spec finns separat och används som referens vid behov. Denna
> version innehåller bara det som behövs för att bygga alpha korrekt.

---

## 0. VAD DETTA ÄR

Life OS / My Money Master = ett personligt "operativsystem" för hela livet:
arbete/lön, ekonomi, dokument. Byggs på **Lovable (React + Tailwind) + Supabase
(PostgreSQL, Auth, RLS)**. Svenskt UI, engelsk kod.

**Nordstjärnan:** "Mitt liv, organiserat."

**ABSOLUT REGEL:** Detta projekt får ALDRIG blandas med 4ThePeople / Glow Up /
webshoppen. Ingen delad kod, databas, design eller funktion. Om du ser
webshop-kod — rör den inte.

---

## 1. DE 20 LAGARNA (högsta auktoritet)

1. **User First** — användaren först, allt annat sekundärt
2. **User Owns Everything** — användaren äger all data, ingen dold profilering/försäljning
3. **AI Is Optional** — allt fungerar utan AI, AI är alltid tillval
4. **Offline First** — kärnan fungerar utan internet
5. **Security By Default** — säkerhet är standard, aldrig tillval
6. **Privacy By Default** — minsta datainsamling, minsta delning, full transparens
7. **Object First** — allt bygger på objekt, inte skärmar
8. **One Source Of Truth** — info finns på ETT ställe, alla vyer läser samma data
9. **Reuse Before Build** — återanvänd först, bygg nytt bara vid verkligt behov
10. **No Mockups** — inga falska knappar, inga tomma funktioner; allt syns = fungerar
11. **Everything Is Reversible** — alltid ångra/återställa/exportera/lämna
12. **Transparency** — systemet kan förklara vad det gör, varför, vilken data
13. **Modularity** — allt utanför kärnan är utbytbart (AI, OCR, moln, plugins)
14. **No Vendor Lock-In** — ingen leverantör blir ett krav
15. **Long-Term Thinking** — varje beslut ska hålla i 10 år
16. **Quality Over Quantity** — färre genomarbetade funktioner > många halvfärdiga
17. **Test Before Release** — ingen release utan test + backup + testad återställning
18. **Accessibility** — användbart för så många som möjligt
19. **Performance** — snabbt även med mycket data
20. **Consistency** — samma regler, språk, beteende överallt

**Tie-breaker:** vid lika bra lösningar, välj den som är enklare, säkrare, mer
privat, mer modulär, mer framtidssäker, lättare att underhålla.

---

## 2. ICKE-FÖRHANDLINGSBARA BYGGREGLER

Dessa har bitit oss förr. Bryt dem aldrig:

- **Timlön = alltid textfält.** ALDRIG stepper, +1-knappar eller slider.
- **Pass över midnatt = EN post** (`crosses_midnight=true`, `end_date` satt).
  Splittra aldrig till två pass. OB delas korrekt vid midnatt i beräkningen.
  Kalendern får visa passet över två dagar, men datan är en rad.
- **Löneregler (OB/jour/rast) = DATA i databasen, inte hårdkod.** Användaren
  skapar regler per profil. Beräkningen visar VILKA regler som användes — aldrig svart låda.
- **Alla tider lagras i UTC**, visas i Europe/Stockholm. (DST-säkerhet.)
- **RLS på ALLA tabeller från dag ett.** `auth.uid() = user_id`. Ingen
  service-role-nyckel i klientkoden — någonsin.
- **Soft delete överallt** (`deleted_at`), papperskorg 30 dagar. Radera aldrig hårt direkt.
- **Planerat schema, faktiskt arbete och utbetald lön är TRE olika saker.**
  Blanda aldrig ihop. Originalschema skrivs aldrig över när verkligheten ändras.
- **Löneavvikelser:** säg "möjlig avvikelse" / "behöver kontrolleras" —
  ALDRIG "arbetsgivaren gjorde fel". Systemet skickar aldrig något automatiskt.
- **Intjänat ≠ utbetalt.** Lön betalas för en TIDIGARE period. Visa alltid
  "intjänat denna period" och "nästa utbetalning" som TVÅ skilda saker med
  rätt periodetikett. Blanda aldrig ihop dem. (Del 62.)
- **Extrapass kan ha annan lön** (t.ex. 2,4×). Måste gå att sätta per pass
  (`pay_override_type/value`) OCH som regel per kategori. Per-pass slår regel.
  Lönemotorn visar alltid vilken som gällde. Multiplikator = textfält.
- **Dashboard är centrum.** Appen byggs runt en Dashboard/Home, inte lösa
  sidor. Dashboard VISAR (widgets + Quick Add), sidorna HANTERAR. Logotyp =
  hem. Max 3 navigationsnivåer. Nya funktioner blir widgets/Inbox-poster,
  inte nya sidor. (Del 61.)

---

## 3. NAMNKONVENTION (One Source Of Truth)

Ett koncept = ett namn i varje lager:
- DB: `work_shifts` → Komponent: `WorkShift` → UI (svenska): "Arbetspass"
- DB: `work_profiles` → `WorkProfile` → "Arbetsprofil"
- DB: `payslips` → `Payslip` → "Lönespecifikation"

Requirement-ID i commits/kommentarer: `[KATEGORI]-[NUMMER]`, t.ex. `[AUTH-001]`.

---

## 4. ALPHA-MODULER (vad som byggs NU)

Bygg i denna ordning. Inget senare steg börjar innan föregående fungerar + testas.

1. **Auth & Säkerhet** (Fas 0) — Supabase Auth, RLS, sessioner
2. **Arbete & Lön** (prio 1) — arbetsprofiler, pass, rastregler, OB, jour, schema
3. **OCR & Schema-import** (prio 1) — ladda upp → tolka → granska → godkänn → skapa pass
4. **Lönespec + Lönemotor** — importera lönespec, jämför mot appens uträkning
5. **Ekonomi** — konton, utgifter, budget, räkningar, skulder, sparmål
6. **Dokument** — vault, OCR, kategorier, utgångsdatum
7. **Dashboard** — levande startsida som binder ihop allt

Allt annat (Business OS, bokning, CRM, marketplace, AI-experter osv.) = senare
faser. Se full spec Del 56–58. Bygg inte det nu.

## 4B. KANONISK MOTORKARTA — ~10 motorer, inte 100

Många "motorer" i specen är samma sak under olika namn. Innan du bygger en
ny "engine": kolla om den redan är en av dessa. Bygg den då som en funktion
DÄR, inte som ett nytt system. (Full mappning: spec Del 63.)

1. **Object Engine** — ett objektschema för allt (pass, dokument, bil, hus,
   försäkring, produkt). Även: Object Model/Hub, Digital Twin, Vault, Profiler,
   Lifecycle. Digital Twin = en VY av ett objekt + allt kopplat, inte en motor.
2. **Relationship Engine** — `object_relations` kopplar objekt↔objekt. Även:
   Life Graph, Knowledge Graph, Dependencies, Context. Samma fil kopplas till
   FLERA objekt utan dubbletter (ett kvitto → produkt+garanti+transaktion).
3. **Event Engine** — varje ändring = ett event. Även: Timeline, Activity/Life
   Feed, Time Machine, History, Audit Log (alla är VYER av samma eventström).
4. **Version Engine** — tidigare versioner + återställ. Även: Drafts, Undo.
5. **Rules & Automation** — OM→villkor→action. Även: Policy, Workflow, Suggestions.
6. **Validation & Health** — regler mot data. Även: Integrity, Health Score,
   Diagnostics, Readiness. Visar bara, ändrar aldrig automatiskt.
7. **Import & Document** — EN scanner (Del 59). Även: OCR, Merge, Import History.
8. **Search & Index** — Cmd/K sök + kommandon (Del 61). Även: Command Center.
9. **Dashboard & Widgets** — startsidan (Del 61). Även: State/Adaptive (byggs sist).
10. **Security & Permission** — auth, RLS, roller. Växer för multi-tenant (Del 64).

Cache/Job/Resource/Connector/Performance m.m. = teknisk infrastruktur, inte
egna produktmotorer. Byggs när skalan kräver, specas inte nu.

**Multi-tenant (uthyrning):** förbered `org_id` på alla tabeller redan i alpha
(billigt nu, smärtsamt senare). Full org/roll-modell byggs i V1/V2. Se Del 64.

---

## 5. DATABAS — ALPHA-SCHEMA (Supabase)

Sju kärntabeller. Alla har `user_id`, `created_at`, `updated_at`, och de flesta
`deleted_at` (soft delete). RLS på alla.

```sql
-- profiles: en per användare
profiles (id, user_id→auth.users UNIQUE, name, avatar_url,
          hourly_rate, tax_column=33)

-- work_profiles: obegränsat antal per användare (flera arbetsgivare)
work_profiles (id, user_id, name, employer, workplace, role,
               hourly_rate, monthly_salary, tax_column=33,
               vacation_pay_percent=12.0, pay_period_start_day,  -- period ≠ månad
               payday_day, payday_offset_months=1,   -- lönedag + hur många mån efter perioden
               is_active, deleted_at)

-- workplaces: flera arbetsplatser per arbetsgivare (olika OB/restid/adress)
workplaces (id, user_id, work_profile_id, name, address, travel_minutes, notes, deleted_at)

-- work_shifts: pass. crosses_midnight = EN post över midnatt
work_shifts (id, user_id, work_profile_id, workplace_id, date, start_time, end_time,
             crosses_midnight=false, end_date, break_minutes, break_paid,
             is_on_call, is_standby, overtime_minutes,
             shift_category='ordinary',  -- ordinary/extra/overtime/on_call/standby/inbeordrad
             pay_override_type, pay_override_value,  -- multiplier/fixed_hourly/fixed_total (t.ex. 2.4)
             pay_period_id,              -- vilken löneperiod passet tillhör
             status='planned',      -- planned/worked/sick/vacation/vab/cancelled
             shift_code,            -- D/K/N/J/B/SEM/LEDIG eller custom
             notes, source='manual', import_batch_id, deleted_at)

-- break_rules: rastregler PER profil (data, inte hårdkod)
break_rules (id, work_profile_id, after_hours, break_minutes, is_paid)

-- ob_rules: ALLA löneregler PER profil (data, inte hårdkod). EN tabell för
-- OB/övertid/jour/extra. (Kanoniskt beslut Del 62B — ersätter gamla pay_rules.)
ob_rules (id, user_id, work_profile_id, name,
          rule_type,             -- ob/overtime/on_call/night/weekend/holiday/base_hourly/...
          applies_to_category,   -- NULL=alla, annars 'extra' etc (extra-pass = egna regler)
          valid_from, valid_to,  -- historik: regeln gällde en viss period
          day_of_week[], start_time, end_time, holiday_type,
          rate_type,             -- multiplier/fixed_addition/fixed_amount
          multiplier, fixed_amount,
          priority=10, stacking_allowed=true)  -- vilken regel vinner + får staplas

-- import_batches: spårar hela scan-importen så den kan ångras samlat
import_batches (id, user_id, document_id, detected_type, type_confidence,
                confirmed_type, status='classified', items_proposed,
                items_imported, items_skipped_dupe, reverted_at)

-- payslips: importerad lönespec
payslips (id, user_id, work_profile_id, period_start, period_end,
          gross_salary, net_salary, tax_amount, ob_amount, on_call_amount,
          vacation_pay, overtime_amount, total_hours,
          document_id, ocr_raw, verified_at, deleted_at)

-- ekonomi
expenses (id, user_id, amount, currency='SEK', category, subcategory,
          description, date, expense_type='expense',   -- expense/bill/subscription/debt_payment
          is_recurring, recurrence_interval, receipt_id, project_id, notes, deleted_at)
debts (id, user_id, name, debt_type,    -- mortgage/personal_loan/csn/credit_card/private/installment
       original_amount, current_amount, interest_rate, monthly_payment,
       minimum_payment, start_date, end_date, lender, notes, deleted_at)

-- dokument / vault
documents (id, user_id, title, document_type,   -- payslip/schema/receipt/contract/warranty/insurance/other
           file_url, file_name, file_size, mime_type,
           ocr_text, ocr_confidence, ocr_status='pending', ai_summary,
           metadata JSONB, tags[], expires_at, deleted_at)
```

**Index (kritiska):**
```sql
idx_work_shifts_user_date ON work_shifts(user_id, date) WHERE deleted_at IS NULL;
idx_expenses_user_date    ON expenses(user_id, date)    WHERE deleted_at IS NULL;
idx_documents_user        ON documents(user_id)         WHERE deleted_at IS NULL;
```

**RLS-mall (samma för ALLA tabeller):**
```sql
ALTER TABLE <tabell> ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own rows only" ON <tabell> FOR ALL USING (auth.uid() = user_id);
```

---

## 6. SVENSKA LÖNEREGLER (defaults, men lagras som data)

- **Semesterersättning:** 12% för timanställda (`vacation_pay_percent`)
- **Skatt:** kolumn 33 som default (`tax_column`), per profil
- **OB-exempel** (skapas som `ob_rules`, ej hårdkod):
  Kväll, natt, helg (lör–sön), storhelg. Multiplikator eller fast tillägg.
- **Jour lör 20:00 → sön 08:00** ska räknas korrekt — OB byter nivå vid midnatt
  men passet är fortfarande EN post.
- Lönemotorn visar alltid VILKA regler som gav vilket belopp (spårbart).

---

## 7. SCANNER — EN scanner för allt (klassificera FÖRST)

**Grundregel: scannern gör INGENTING med datan förrän den vet vad
dokumentet är och användaren bekräftat det.** Det finns EN scanner, inte
en per dokumenttyp — samma motor med olika fältmallar per typ.

Flöde (bryt aldrig ordningen):
1. **Ladda upp** → spara originalet i `documents` OFÖRÄNDRAT, direkt.
2. **Klassificera** — vad ÄR detta? schema / payslip / receipt / invoice /
   contract / warranty / insurance / id_document / other. Regelbaserat
   först (fungerar utan AI), AI valfritt ovanpå.
3. **Visa gissad typ** — "Detta ser ut som: Lönespec. Stämmer det?".
   Vid osäker typ: FRÅGA, gissa aldrig. Ingen auto-import.
4. **Typspecifik extraktion** — fält med confidence (95%+ auto, 70% bekräfta,
   under = manuellt). Fyll aldrig i osäkra fält tyst.
5. **Förhandsgranska** — schema visas som FÖRESLAGNA pass, inte skapade.
6. **Dubblettkontroll** (obligatorisk) mot befintliga pass: samma profil +
   datum + överlappande tid = möjlig dubblett → hoppa över / ersätt /
   behåll båda. Aldrig tyst överskrivning eller tyst dubblett.
7. **Användaren godkänner** → skriv till DB (`source='ocr'`, `import_batch_id`).
8. Hela batchen kan **ångras** samlat.

**Kritiska scanner-regler:**
- En screenshot av appens EGNA schema-/tidvy får ALDRIG tolkas som nytt
  schema och skapa pass. Varna, kräv extra bekräftelse. (Skydd mot spökpass.)
- **Lönespec matar tillbaka inställningar:** när en payslip scannas föreslår
  systemet OB-regler, timlön, skattekolumn, semesterprocent och ev. ny
  arbetsprofil UR dokumentet — men allt som förslag, aldrig auto-satt.
- Original skrivs aldrig över; OCR-resultatet är alltid en kopia.
- Flersidigt + roterade/sneda bilder ska hanteras.
- OCR-motorn är utbytbar (Tesseract.js nu → AI-gateway senare); klassificering
  och godkännande är oberoende av OCR-leverantör.

Full detalj: se spec Del 59 (Universal Scan & Import Engine) + Del 60.

---

## 8. TEKNISKA MÖNSTER (React/Lovable)

- **State:** Zustand per domän (work, finance, docs). React Query för serverdata.
- **Formulär:** react-hook-form + zod-validering.
- **ErrorBoundary** per feature — en trasig modul tar inte ner appen.
- **Idempotens:** kritiska skrivningar (t.ex. betalning, OCR-import) har
  `idempotency_key UNIQUE` för att undvika dubbletter vid retry.
- **Konfliktlösning:** för lön/ekonomi, låt användaren välja vid krock —
  aldrig "last write wins" tyst.

---

## 9. LOVABLE-ARBETSSÄTT

- Läs hela detta dokument innan du börjar. Säg aldrig "för stort" — dela upp istället.
- Buggar före features. Rör aldrig fungerande kod utan instruktion.
- Commit efter varje delsteg. Testa innan nästa steg. Steg ≤ ~30 min.
- RLS på alla tabeller från dag ett.
- Rapportera "Klart: / Kvar:" och vänta på nästa instruktion.
- Blanda ALDRIG in 4ThePeople-kod.

---

## 10. FAS-ORDNING (requirement-ID)

**Fas 0 — blockers (byggs allra först):**
`AUTH-001` SMTP/e-postverifiering · `AUTH-002` stabil session ·
`SEC-001` RLS på alla tabeller · `SEC-002` ingen service-role i klient ·
`AUTH-003` glömt lösenord

**Fas 1 — kärnfunktion:**
`WORK-001..004` arbetsprofiler + pass + schema ·
`PAY-001..003` löneuträkning + skatt + semesterersättning ·
`OCR-001..004` schema-import

**Fas 2 — MVP:**
`PAY-004/005` simulator + lönespec-jämförelse ·
`FIN-001..004` ekonomi · `DOC-001..003` dokument ·
`DASH-001/002` dashboard · `SEC-003/004` session-timeout + Trust Dashboard ·
`UX-001..005`

Detaljer per krav finns i full spec Del 51–52.
