# MY MONEY MASTER — PERMANENT REQUIREMENTS LEDGER

> Spårbar kravförteckning över HELA visionen (spec v3.2, 6704 rader, Del 1–65)
> plus alla tillägg från konversationerna. Ingenting avfärdas — allt registreras
> med status och aktiveringsväg. Detta är levande källdokument.
>
> **Bevisbas:** kod-zip `My_Money_Master` (TanStack Start + Supabase),
> 24 tabeller, 21 routes, 14 salary/planning-moduler, 1 server-funktion, 55 komponenter.
> Migration `UPGRADE_01_grunden.sql` (v2, härdad) tillagd men EJ körd mot live-DB.

## STATUS-LEGEND
- **VERIFIED_COMPLETE** — hela kedjan finns (DB→RLS→backend→validering→UI→flöde→fel→mobil) och rimligt testbar
- **BUILT_NOT_TESTED** — koden finns men kedjan ej verifierad end-to-end
- **PARTIAL** — vissa lager finns, andra saknas
- **MISSING** — inget i koden
- **MISPLACED** — finns men på fel ställe / fel lager
- **DUPLICATED** — finns i flera exemplar (kod eller spec)
- **CONFLICTING** — motstridiga beslut i spec/kod
- **DEFERRED_ARCHITECTURE_READY** — framtida, men datamodell/arkitektur förberedd
- **DEFERRED_NOT_PREPARED** — framtida, ingen arkitektur ännu
- **NOT_POSSIBLE_IN_CURRENT_PLATFORM** — kräver annat än Lovable/Supabase-stacken

## PRIORITET
P0 = blockerare · P1 = alpha-kärna · P2 = MVP · P3 = V1 · P4 = V2/framtid

---

# A. KÄRNA & ANVÄNDARE

| ID | Krav | Källa | Status | Kod / bevis | Beroenden | Prio | Fas | Test |
|----|------|-------|--------|-------------|-----------|------|-----|------|
| CORE-AUTH-001 | E-post/lösenord-inlogg | Del 24 | BUILT_NOT_TESTED | `routes/auth.tsx`, `auth_.callback.tsx` | Supabase Auth | P0 | 0 | Logga in/ut, fel lösen |
| CORE-AUTH-002 | E-postverifiering | Del 24 | BUILT_NOT_TESTED | `auth_.check-email.tsx`, `auth_.confirmed.tsx` | SMTP | P0 | 0 | Overifierad blockeras |
| CORE-AUTH-003 | Glömt/återställ lösenord | Fas 0 | BUILT_NOT_TESTED | `auth_.forgot-password.tsx`, `auth_.reset-password.tsx` | SMTP | P0 | 0 | Hela reset-flödet |
| CORE-AUTH-004 | Stabil session (F5, refresh) | Fas 0 | PARTIAL | Supabase-klient finns; persistSession ej verifierad | — | P0 | 0 | F5 loggar ej ut |
| CORE-SEC-001 | RLS på alla tabeller | Del 24 | VERIFIED_COMPLETE | Alla 24 tabeller har `ENABLE ROW LEVEL SECURITY` + policy | — | P0 | 0 | Läs annans rad → tom |
| CORE-SEC-002 | Ingen service-role i klient | Del 24 | PARTIAL | Ej granskat i denna revision | — | P0 | 0 | Sök klientbundle |
| CORE-ONB-001 | Onboarding-flöde | Del 21 | PARTIAL | `profiles.onboarded` finns; flöde ej verifierat | Auth | P1 | 1 | Ny användare → wizard |
| CORE-PROF-001 | Användarprofil (namn, avatar) | Del 24 | BUILT_NOT_TESTED | `profiles`, `installningar.profil-och-regler.tsx` | Auth | P1 | 1 | Redigera profil |
| CORE-ROLE-001 | Roller & behörigheter | Del 10, 49 | PARTIAL | `user_roles`, `teams`, `team_members` finns (tomma stubs) | — | P3 | V1 | — |
| CORE-HOUSE-001 | Hushåll / familj | Del 9, 10 | DEFERRED_ARCHITECTURE_READY | `teams` kan återanvändas; ingen UI | Roller | P4 | V2 | — |
| CORE-CARE-001 | Brukare (LSS/vård) | Del 64 | DEFERRED_NOT_PREPARED | Ingen modell | Multi-tenant | P4 | V2 | — |
| CORE-STAFF-001 | Personal / arbetsledning | Del 64 | DEFERRED_NOT_PREPARED | Ingen modell | Multi-tenant | P4 | V2 | — |
| CORE-MULTI-001 | Fleranvändarstöd / delning | Del 64 | DEFERRED_NOT_PREPARED | RLS är per user_id; ingen delningsmodell | Tenant | P4 | V2 | — |
| CORE-AUDIT-001 | Audit-logg | Del 49 | MISSING | Ingen audit-tabell | — | P3 | V1 | — |
| CORE-GDPR-001 | GDPR: export all data | Del 17, 49 | MISSING | Ingen export-funktion | — | P2 | MVP | Exportera JSON/zip |
| CORE-GDPR-002 | GDPR: radera konto+data | Del 17, 49 | MISSING | ON DELETE CASCADE finns; ingen UI-flöde | — | P2 | MVP | Radera → allt bort |
| CORE-BACKUP-001 | Backup & återställning | Del 17, 29 | PARTIAL | Supabase-backup finns; ingen testad restore | — | P2 | MVP | Restore-test |
| CORE-OFFLINE-001 | Offline-first kärna | Del 3, 17, 32 | MISSING | Ingen offline-cache/PWA sett | — | P3 | V1 | Flygplansläge |

---

# B. ARBETE & LÖN

| ID | Krav | Källa | Status | Kod / bevis | Beroenden | Prio | Fas | Test |
|----|------|-------|--------|-------------|-----------|------|-----|------|
| WORK-PROF-001 | Flera arbetsprofiler | Del 14.2 | BUILT_NOT_TESTED | `work_profiles` (rik: 22 kol), `installningar.lon-arbete.tsx` | Auth | P1 | 1 | Skapa 2 profiler |
| WORK-PROF-002 | Arbetsgivare/yrke/avtal | Del 14.2 | BUILT_NOT_TESTED | `work_profiles.employer/occupation/collective_agreement` | — | P1 | 1 | — |
| WORK-PLACE-001 | Flera arbetsplatser per profil | Del 59, konv. | BUILT_NOT_TESTED | `workplaces` (ny i UPGRADE_01) | WORK-PROF | P2 | 1 | Koppla pass→plats |
| WORK-SHIFT-001 | Skapa/redigera pass | Del 14.2 | BUILT_NOT_TESTED | `shifts`, `jobb.tsx` (733 rader) | Profil | P1 | 1 | CRUD pass |
| WORK-SHIFT-002 | Pass över midnatt (en rad) | Del 62, konv. | VERIFIED_COMPLETE | `shifts.starts_at/ends_at` timestamptz; `ob.ts splitByDay` | — | P1 | 1 | 22–02 = 4h |
| WORK-SHIFT-003 | Snabbinmatning (fritext) | Del 14.2 | BUILT_NOT_TESTED | `salary/parser.ts parseQuickCommand` | — | P2 | 1 | "07-16 mån v28" |
| WORK-SHIFT-004 | Extrapass (is_extra) | kod | BUILT_NOT_TESTED | `shifts.is_extra` + ny `shift_category` | OB-regler | P1 | 1 | Extra→andra regler |
| WORK-ONCALL-001 | Jour (vaken) | kod | BUILT_NOT_TESTED | `compute.ts waking_on_call` | — | P1 | 1 | Jour-timlön |
| WORK-ONCALL-002 | Sovande jour + utryckning | kod | BUILT_NOT_TESTED | `compute.ts sleeping_on_call` + callout_rate | — | P1 | 1 | Aktiv tid extra |
| WORK-STANDBY-001 | Beredskap | kod | BUILT_NOT_TESTED | `compute.ts standby` | — | P1 | 1 | — |
| WORK-OB-001 | OB regelstyrd (data) | Del 26, 62B | BUILT_NOT_TESTED | `ob.ts` + `work_profiles.ob_rules` JSONB + DEFAULT_OB_RULES | — | P1 | 1 | Kväll/natt/helg OB |
| WORK-OB-002 | OB visar breakdown | Del 26 | VERIFIED_COMPLETE | `ob.ts CalcResult.breakdown` | — | P1 | 1 | Se vilka regler |
| WORK-OT-001 | Övertid | Del 62 | PARTIAL | `work_profiles.overtime_rules` JSONB finns; logik ej sett | — | P2 | 1 | — |
| WORK-OT-002 | Mertid | spec | MISSING | Ingen separat mertidslogik | — | P2 | 1 | — |
| WORK-BREAK-001 | Raster regelstyrt | Del 26 | BUILT_NOT_TESTED | `salary/breaks.ts` | — | P1 | 1 | Auto-rast 6h+ |
| WORK-RED-001 | Röda dagar påverkar OB | Del 60 | PARTIAL | `calendar/holidays.ts isRedDay` + ny `holiday_rules` | OB | P2 | 1 | Röd dag = högre OB |
| WORK-VAC-001 | Semester | Del 53 | BUILT_NOT_TESTED | `vacation_balance`, `planning/vacation.ts` | — | P2 | 2 | Semesterdagar |
| WORK-ABS-001 | Frånvaro/sjuk/VAB | Del 53 | BUILT_NOT_TESTED | `absences` tabell | — | P2 | 2 | Registrera sjuk |
| WORK-ROT-001 | Rotationer/skiftcykler | Del 53 | BUILT_NOT_TESTED | `rotations`, `planning/rotations.ts` | — | P2 | 2 | Rullande schema |
| WORK-PAT-001 | Veckomönster | Del 53 | BUILT_NOT_TESTED | `weekly_patterns` | — | P2 | 2 | — |
| WORK-TMPL-001 | Passmallar | kod | BUILT_NOT_TESTED | `shift_templates`, `salary/templates.ts` | — | P2 | 1 | — |
| WORK-PERIOD-001 | Löneperiod ≠ månad | Del 60, 62 | BUILT_NOT_TESTED | `pay_periods` + `work_profiles.pay_period_start_day` (UPGRADE_01) | — | P1 | 1 | Period 16→15 |
| WORK-PAYDAY-001 | Utbetalningsdatum | Del 62 | PARTIAL | `payday_day/offset_months` finns; ingen beräkning | Period | P1 | 1 | Nästa lön-datum |
| WORK-EARN-001 | Intjänat ≠ utbetalt (två widgets) | Del 62 | MISSING | Ingen dashboard-logik för detta än | Period | P1 | 1 | Två separata tal |
| WORK-TAX-001 | Skatt (kolumn/procent) | Del 26 | BUILT_NOT_TESTED | `work_profiles.tax_rate`, `planning/tax.ts` | — | P1 | 1 | Skatteavdrag |
| WORK-GROSS-001 | Bruttolön-beräkning | Del 26 | BUILT_NOT_TESTED | `compute.ts` total_amount | — | P1 | 1 | — |
| WORK-NET-001 | Nettolön-beräkning | Del 26 | PARTIAL | `planning/tax.ts` finns; ej verifierad end-to-end | Skatt | P1 | 1 | Netto efter skatt |
| WORK-PAYSLIP-001 | Lönespec sparas | Del 14.4, 57 | PARTIAL | `payslips`-tabell (UPGRADE_01); ingen UI/import | Scanner | P2 | 3 | — |
| WORK-CMP-001 | Jämför beräknad vs verklig lön | Del 57 | MISSING | Ingen jämförelselogik | Payslip | P2 | 3 | Avvikelse flaggas |
| WORK-DEV-001 | Avvikelsevarningar (neutralt språk) | Del 57 | MISSING | — | Jämförelse | P2 | 3 | "möjlig avvikelse" |

---

# C. SCANNER, IMPORT & AI

| ID | Krav | Källa | Status | Kod / bevis | Beroenden | Prio | Fas | Test |
|----|------|-------|--------|-------------|-----------|------|-----|------|
| SCAN-OCR-001 | Schemafoto → OCR | Del 14.3, 59 | BUILT_NOT_TESTED | `lib/schedule-ocr.functions.ts` (Gemini via Lovable AI) | AI-nyckel | P1 | 3 | Foto→pass |
| SCAN-PDF-001 | PDF-schema | Del 59 | PARTIAL | OCR tar bild; PDF-hantering ej sett | — | P2 | 3 | Flersidig PDF |
| SCAN-CLASS-001 | Dokumentklassificering (schema/lönespec/...) | Del 59, konv. | MISSING | Scannern antar alltid "schema" | — | P1 | 3 | Lönespec≠schema |
| SCAN-PAYSLIP-001 | Lönespec-scanning | Del 59, konv. | MISSING | Ingen payslip-OCR | Klass. | P2 | 3 | Läs lönespec |
| SCAN-FEEDBACK-001 | Lönespec matar tillbaka inställningar | Del 59, konv. | MISSING | — | Payslip-scan | P2 | 3 | Föreslå OB-regler |
| SCAN-CONF-001 | OCR-confidence per fält | Del 59 | PARTIAL | OCR ger confidence per rad; ej per fält | — | P1 | 3 | <0.7 = bekräfta |
| SCAN-VERIFY-001 | Manuell verifiering före spara | Del 59 | BUILT_NOT_TESTED | `importera.tsx` förhandsgranskning | — | P1 | 3 | Granska→godkänn |
| SCAN-DUPE-001 | Dubblettskydd | Del 59, konv. | PARTIAL | `conflicts.ts` + `importera.tsx` överlappskoll (skip/replace) | — | P1 | 3 | Samma pass 2ggr |
| SCAN-GHOST-001 | Spökpass-skydd (egen app-screenshot) | Del 59, konv. | MISSING | Ingen self-import-detektion | — | P1 | 3 | Screenshot→varning |
| SCAN-HIST-001 | Importhistorik | Del 59 | PARTIAL | `import_batches` (UPGRADE_01); ingen UI | — | P2 | 3 | Lista importer |
| SCAN-UNDO-001 | Ångra hel import | Del 59, konv. | PARTIAL | `shifts.import_batch_id` + soft delete (UPGRADE_01); ingen UI | Batch | P1 | 3 | Ångra batch |
| SCAN-ORIG-001 | Spara originalfil | Del 59 | MISSING | OCR sparar ej originalet i `documents` | Documents+storage | P1 | 3 | Original kvar |
| SCAN-FALL-001 | Fallback om AI nere | Del 29, konv. | MISSING | Kastar fel om LOVABLE_API_KEY saknas; ingen manuell fallback | — | P2 | 3 | AI ner→manuell |
| SCAN-COST-001 | AI-kostnadskontroll | konv. | MISSING | Ingen kostnadsmätning | — | P3 | 3 | — |
| SCAN-LEARN-001 | Användarkorrigeringar förbättrar tolkning | Del 59, 60 | MISSING | `ocr_fields.corrected_value` finns; ingen lärande-loop | OCR-fields | P3 | V1 | — |
| SCAN-RECEIPT-001 | Kvitto-scanning | Del 59 | MISSING | — | Klass. | P3 | V1 | — |
| SCAN-INVOICE-001 | Faktura-scanning | Del 59 | MISSING | — | Klass. | P3 | V1 | — |
| SCAN-DOC-001 | Avtal/garanti/försäkring-scan | Del 59 | MISSING | — | Klass. | P3 | V1 | — |
| SCAN-SERIAL-001 | Serie-/modellnummer-extraktion | konv. | MISSING | — | Doc-scan | P4 | V2 | — |

*(Fortsätter i LEDGER_DEL2: Ekonomi, Livsplanering, Dokument, Organisation/kommersiellt)*

---

# D. EKONOMI

| ID | Krav | Källa | Status | Kod / bevis | Beroenden | Prio | Fas | Test |
|----|------|-------|--------|-------------|-----------|------|-----|------|
| FIN-EXP-001 | Utgifter (CRUD) | Del 14.7 | BUILT_NOT_TESTED | `expenses`, `pengar.tsx` (203 rader) | Auth | P2 | 2 | Skapa utgift |
| FIN-CAT-001 | Kategorier | Del 14.7 | PARTIAL | `expenses.category` fält; ingen kategori-hantering | — | P2 | 2 | — |
| FIN-INC-001 | Inkomster | Del 14.7 | PARTIAL | Lön finns; övriga inkomster oklart | — | P2 | 2 | — |
| FIN-ACC-001 | Konton | Del 14.7 | MISSING | Ingen konto-tabell | — | P3 | V1 | — |
| FIN-BUD-001 | Budget | Del 14.7 | PARTIAL | `finance/score.ts` refererar budget; ingen budget-modell | — | P2 | 2 | — |
| FIN-FCT-001 | Prognos | Del 14.7 | MISSING | Ingen prognoslogik | Budget | P3 | V1 | — |
| FIN-SUB-001 | Abonnemang/fasta kostnader | Del 14.7 | PARTIAL | `expenses.is_recurring` finns; ingen dedikerad vy | — | P2 | 2 | Återkommande |
| FIN-DEBT-001 | Skulder/lån/räntor | Del 14.7 | MISSING | Bara referens i `action-sheet/actions.ts`; ingen tabell | — | P2 | 2 | — |
| FIN-AMORT-001 | Amortering/betalningsplaner | Del 14.7 | MISSING | — | Skulder | P3 | V1 | — |
| FIN-SAVE-001 | Sparmål | Del 14.7 | PARTIAL | `profiles.monthly_buffer_goal` finns | — | P2 | 2 | — |
| FIN-INS-001 | Försäkringar | Del 14.7 | MISSING | — | Dokument | P3 | V1 | — |
| FIN-ASSET-001 | Tillgångar/ägodelar/värde | Del 53 | MISSING | — | Dokument | P3 | V1 | — |
| FIN-PRICE-001 | Prisjämförelse matbutiker (ICA/Coop/Willys) | konv., Del 53 | DEFERRED_NOT_PREPARED | Ingen modell/integration | Extern data | P4 | V2 | — |
| FIN-BANK-001 | Bankkoppling | Del 18, 58 | NOT_POSSIBLE_IN_CURRENT_PLATFORM | Kräver PSD2/Tink-integration + backend | Extern | P4 | V2 | — |
| FIN-PARTNER-001 | Partnerapp för lån | konv. | DEFERRED_NOT_PREPARED | Affärsidé; ingen arkitektur | — | P4 | V2 | — |
| FIN-PAYDAY-001 | Payday Center | Del 57 | DEFERRED_ARCHITECTURE_READY | `payslips`+`pay_periods` förberett; ingen modul | Lönespec-scan | P2 | 3 | — |

---

# E. LIVSPLANERING

| ID | Krav | Källa | Status | Kod / bevis | Beroenden | Prio | Fas | Test |
|----|------|-------|--------|-------------|-----------|------|-----|------|
| LIFE-TODAY-001 | Idag-vy | Del 14.1 | BUILT_NOT_TESTED | `idag.tsx` (153 rader) | — | P1 | 2 | Dagens översikt |
| LIFE-CAL-001 | Kalender | Del 14.5 | BUILT_NOT_TESTED | `kalender.tsx` (644), `calendar/*` | Pass | P1 | 2 | Månad/vecka |
| LIFE-PLAN-001 | Planering | Del 12 | BUILT_NOT_TESTED | `planering.tsx` (697), `planning/*` | — | P2 | 2 | — |
| LIFE-NAME-001 | Namnsdagar/helgdagar | Del 26 | BUILT_NOT_TESTED | `calendar/namedays.ts`, `holidays.ts` | — | P3 | 2 | — |
| LIFE-TASK-001 | Uppgifter | Del 12 | PARTIAL | `reminders` finns; ingen full task-modell | — | P2 | 2 | — |
| LIFE-ROUT-001 | Rutiner/vanor | Del 32 | MISSING | Ingen vane-modell | — | P3 | V1 | — |
| LIFE-STREAK-001 | Streaks | Del 11 | MISSING | — | Vanor | P4 | V1 | — |
| LIFE-GOAL-001 | Mål | Del 11 | MISSING | — | — | P3 | V1 | — |
| LIFE-GAME-001 | Belöningar/gamification/uppdrag | Del 11 | MISSING | — | Mål | P4 | V2 | — |
| LIFE-CHORE-001 | Vardagssysslor | Del 32 | MISSING | — | Uppgifter | P3 | V1 | — |
| LIFE-TRAIN-001 | Träning | Del 9 | MISSING | — | — | P4 | V2 | — |
| LIFE-DIET-001 | Kost | Del 9 | MISSING | — | — | P4 | V2 | — |
| LIFE-WEIGHT-001 | Vikt | Del 9 | MISSING | — | — | P4 | V2 | — |
| LIFE-SLEEP-001 | Sömn | Del 9 | MISSING | — | — | P4 | V2 | — |
| LIFE-HEALTH-001 | Hälsa (center) | Del 9, 56 | DEFERRED_NOT_PREPARED | — | — | P4 | V2 | — |
| LIFE-ADDICT-001 | Beroendestöd/återfallshantering | Del 9 | DEFERRED_NOT_PREPARED | Känsligt; ingen modell | — | P4 | V2 | — |
| LIFE-CARE-001 | Personaluppföljning/brukarens självständighet | Del 64 | DEFERRED_NOT_PREPARED | — | Multi-tenant | P4 | V2 | — |
| LIFE-NOTIF-001 | Notifieringar | Del 56 | PARTIAL | `reminders` finns; ingen push/notif-motor | — | P2 | 2 | — |
| LIFE-ESC-001 | Eskalering | Del 56 | MISSING | — | Notif | P4 | V2 | — |
| LIFE-SIGNAL-001 | Proaktiva signaler | Del 7, 56 | BUILT_NOT_TESTED | `signals` tabell, `insikter.tsx` (107) | — | P2 | 2 | — |
| LIFE-TIME-001 | Timeline (life feed) | Del 61 | BUILT_NOT_TESTED | `timeline_events` (alla moduler skriver hit) | — | P2 | 2 | — |

---

# F. DOKUMENT & HEM

| ID | Krav | Källa | Status | Kod / bevis | Beroenden | Prio | Fas | Test |
|----|------|-------|--------|-------------|-----------|------|-----|------|
| DOC-VAULT-001 | Dokumentvault | Del 14.6 | PARTIAL | `documents`-tabell + storage (UPGRADE_01); ingen UI/route | Storage | P2 | 3 | Ladda upp doc |
| DOC-FOLDER-001 | Mappar/taggar | Del 14.6 | PARTIAL | `documents.tags[]` finns; ingen mapp-UI | Vault | P3 | V1 | — |
| DOC-SEARCH-001 | Sökning i dokument | Del 56 | MISSING | Ingen sök-UI | Vault | P3 | V1 | — |
| DOC-OCR-001 | OCR på dokument | Del 14.6 | PARTIAL | `documents.ocr_text/status` + `ocr_fields`; ingen körning | Scanner | P2 | 3 | — |
| DOC-EXP-001 | Utgångsdatum + påminnelser | Del 14.6 | PARTIAL | `documents.expires_at` finns; ingen påminnelse-koppling | Reminders | P3 | V1 | — |
| DOC-WARRANTY-001 | Garantier | Del 14.6 | MISSING | document_type stödjer 'warranty'; ingen logik | Vault | P3 | V1 | — |
| DOC-INS-001 | Försäkringsbrev | Del 14.6 | MISSING | document_type 'insurance'; ingen logik | Vault | P3 | V1 | — |
| DOC-SERIAL-001 | Serienummer/modell/inköpsdatum | konv. | MISSING | `documents.metadata` JSONB kan bära; ingen struktur | Vault | P4 | V2 | — |
| HOME-RENO-001 | Renovering/underhåll | konv. | DEFERRED_NOT_PREPARED | — | — | P4 | V2 | — |
| HOME-PROP-001 | Bostad | konv. | DEFERRED_NOT_PREPARED | — | — | P4 | V2 | — |
| HOME-ENERGY-001 | Energi/vatten | konv. | DEFERRED_NOT_PREPARED | — | — | P4 | V2 | — |
| HOME-INV-001 | Inventarier | konv. | DEFERRED_NOT_PREPARED | — | Vault | P4 | V2 | — |

---

# G. ORGANISATION & FRAMTIDA KOMMERSIELLT

| ID | Krav | Källa | Status | Kod / bevis | Beroenden | Prio | Fas | Test |
|----|------|-------|--------|-------------|-----------|------|-----|------|
| ORG-TENANT-001 | Multi-tenant / tenant-isolering | Del 64 | DEFERRED_NOT_PREPARED | RLS per user_id; ingen tenant-nivå | — | P4 | V2 | — |
| ORG-KOMMUN-001 | Kommunversion (LSS) | Del 64 | DEFERRED_NOT_PREPARED | — | Tenant | P4 | V2 | — |
| ORG-STAFF-001 | Personalportal / arbetsledning | Del 64 | DEFERRED_NOT_PREPARED | `teams`/`team_members`/`user_roles` stubs | Tenant | P4 | V2 | — |
| ORG-STRUCT-001 | Organisationsstruktur | Del 64 | DEFERRED_NOT_PREPARED | — | Tenant | P4 | V2 | — |
| BIZ-OS-001 | Business OS (egenföretagare) | Del 58 | DEFERRED_NOT_PREPARED | — | — | P4 | V2 | — |
| BIZ-CRM-001 | CRM | Del 56, 58 | DEFERRED_NOT_PREPARED | — | Business OS | P4 | V2 | — |
| BIZ-BOOK-001 | Bokningsportal (Privacy Wall) | Del 58 | DEFERRED_NOT_PREPARED | — | Business OS | P4 | V2 | — |
| BIZ-MARKET-001 | Marketplace / Extension platform | Del 56 | DEFERRED_NOT_PREPARED | — | — | P4 | V2 | — |
| BIZ-AIEXP-001 | AI-experter | Del 56 | DEFERRED_NOT_PREPARED | — | — | P4 | V2 | — |
| BIZ-INTEG-001 | Integrationer (Google Cal m.fl.) | Del 31 | DEFERRED_ARCHITECTURE_READY | Ingen; men objektmodell tål det | — | P3 | V1 | — |
| BIZ-LICENSE-001 | Modulär licensiering / betalnivåer | Del 18 | DEFERRED_NOT_PREPARED | — | Tenant | P4 | V2 | — |
| BIZ-WHITE-001 | White-label | Del 64 | DEFERRED_NOT_PREPARED | — | Tenant | P4 | V2 | — |
| BIZ-ADMIN-001 | Administratörsverktyg | Del 64 | DEFERRED_NOT_PREPARED | — | Tenant | P4 | V2 | — |

---

# H. DESIGN, UX & TVÄRGÅENDE (från Del 4, 5, 33, 34, 44, 45)

| ID | Krav | Källa | Status | Kod / bevis | Prio | Fas |
|----|------|-------|--------|-------------|------|-----|
| UX-TOKEN-001 | Design tokens centralt | Del 5, 44 | BUILT_NOT_TESTED | Tailwind + 55 komponenter; token-disciplin ej granskad | P2 | 1 |
| UX-STATE-001 | Alla states (empty/loading/error) | Del 5 | PARTIAL | Vissa finns; ej systematiskt granskat | P2 | alla |
| UX-MOBILE-001 | Mobilvy överallt | Del 5 | PARTIAL | Preview är mobil; ej granskad per skärm | P1 | alla |
| UX-A11Y-001 | Tillgänglighet | Del 32 | MISSING | Ej granskat | P3 | V1 |
| UX-UNDO-001 | Allt reversibelt (ångra) | Del 33, Lag 11 | PARTIAL | Soft delete tillagt; ingen global ångra-UI | P2 | alla |
| UX-CMDK-001 | Universal Search + Cmd+K | Del 56, 61 | MISSING | — | P3 | 4 |
| UX-QUICK-001 | Quick Add (global +) | Del 61 | PARTIAL | `action-sheet/` finns | P2 | 2 |
| UX-DASH-001 | Dashboard som centrum (widgets) | Del 61 | PARTIAL | `dashboard.tsx` (250) finns; inget widget-system | P2 | 4 |

---

*(Sammanfattning, gap-rapport och master-backlog i separata filer: GAP_RAPPORT.md, MASTER_BACKLOG.md)*

---

# I. ARKITEKTUR & PLATTFORM (tillagt under CTO-granskning)

Grundkapabiliteter som inte var explicita krav i spec men som bär hela visionen.
Alla med bevis i migrationer/moduler + ADR.

| ID | Krav | Källa | Status | Kod / bevis | Prio | Fas |
|----|------|-------|--------|-------------|------|-----|
| ARCH-OWN-001 | Kontext-baserat ägarskap (person/hushåll/org) | ADR-002 | BUILT_NOT_TESTED | UPGRADE_03/04, owner_contexts, context_members | P1 | grund |
| ARCH-OWN-002 | Roller + capabilities som data | ADR-002 | BUILT_NOT_TESTED | role_capabilities, auth_has_capability() | P1 | grund |
| ARCH-OWN-003 | Privacy Wall (brukare styr delning) | Del 58, ADR-002 | DEFERRED_ARCHITECTURE_READY | subject-roll + capabilities finns; UI saknas | P3 | V1 |
| ARCH-SAL-001 | Temporal lön (snapshot, oföränderlig) | ADR-001 | BUILT_NOT_TESTED | UPGRADE_02, pay_snapshot, shift-service | P1 | 1 |
| ARCH-SAL-002 | Säker recompute med audit | ADR-001 | BUILT_NOT_TESTED | recomputeShifts(), pay_recompute_log | P1 | 1 |
| ARCH-SAL-003 | Lönemotor-versionering | ADR-001 | VERIFIED_COMPLETE | PAY_ENGINE_VERSION=2 | P1 | 1 |
| ARCH-FIN-001 | Enhetlig transaktionsmodell (in/ut) | ADR-003 | BUILT_NOT_TESTED | UPGRADE_05, transactions | P1 | 2 |
| ARCH-FIN-002 | Multi-valuta (currency+fx_rate+amount_sek) | ADR-003, konv. | BUILT_NOT_TESTED | transactions-kolumner | P1 | 2 |
| ARCH-FIN-003 | Kategorier som data per kontext | ADR-003 | BUILT_NOT_TESTED | categories-tabell | P1 | 2 |
| ARCH-FIN-004 | Historiska växelkurser fryses | ADR-003, konv. | BUILT_NOT_TESTED | fx_rate lagras per transaktion | P2 | 2 |
| ARCH-I18N-001 | Locale-medveten formatering | ADR-004, konv. | BUILT_NOT_TESTED | core/i18n/format.ts (svenskt default, testat identiskt) | P1 | grund |
| ARCH-I18N-002 | Språk/region/valuta/tz oberoende axlar | ADR-004, konv. | BUILT_NOT_TESTED | LocaleSettings, testat sv+NOK | P1 | grund |
| ARCH-I18N-003 | UI-textöversättning (t-funktion) | ADR-004 | DEFERRED_ARCHITECTURE_READY | struktur beslutad; strängar ej extraherade | P3 | V1 |
| ARCH-I18N-004 | Region-regler som data (skatt/helg/enheter) | ADR-004, konv. | PARTIAL | tax_rate flexibel, holiday_rules data; enheter ej byggt | P2 | V1 |
| ARCH-TIME-001 | Tidszons-säker tid (Stockholm↔UTC, DST) | Del 27/42, konv. | BUILT_NOT_TESTED | core/datetime.ts, DST-testad | P1 | grund |
| ARCH-INT-001 | Dataintegritet i DB (pass giltiga, belopp ≥0) | granskning | BUILT_NOT_TESTED | UPGRADE_06 CHECK-constraints | P1 | grund |

---

# J. DETALJKRAV FRÅN SPEC (rad 1490 + 5401+) — säkrade så inget tappas

Fångade vid spec-korskontroll. Många är fördjupningar av befintliga moduler.

## Löneuträkning — svenska detaljer
| ID | Krav | Status | Prio | Fas |
|----|------|--------|------|-----|
| PAY-TAX-002 | Preliminärskatt per skattetabell/kolumn (33,34…) | MISSING | P2 | 2 |
| PAY-EMP-001 | Arbetsgivaravgift (för egenföretagare) | MISSING | P3 | V1 |
| PAY-VAC-002 | Semesterlön 12% auto | PARTIAL (vacation_pay_percent finns) | P2 | 1 |
| PAY-SICK-001 | Sjuklön dag 2–14 (80%) + karensavdrag | MISSING | P2 | 2 |
| PAY-PARENT-001 | Föräldrapenning (SGI-nivåer) | MISSING | P3 | V1 |
| PAY-ROT-001 | ROT/RUT-avdrag beräkning + deklarationsunderlag | MISSING | P3 | V1 |

## Budget — detaljer
| ID | Krav | Status | Prio | Fas |
|----|------|--------|------|-----|
| FIN-BUD-002 | Rullande budget (överförs om ej förbrukad) | MISSING | P2 | 2 |
| FIN-BUD-003 | Budgetmallar per målgrupp (student/familj/pensionär) | MISSING | P3 | 2 |
| FIN-BUD-004 | Sparkvot-mål med auto-beräkning | MISSING | P2 | 2 |

## Import — edge cases (arkitektur finns via import_batches)
| ID | Krav | Status | Prio | Fas |
|----|------|--------|------|-----|
| SCAN-DUPE-002 | Duplikat-varning vid import | PARTIAL | P1 | 3 |
| SCAN-PARTIAL-001 | Partiell import (välj vilka pass) | MISSING | P2 | 3 |
| SCAN-EMPCERT-001 | Arbetsgivarintyg (FK-ansökningar) | MISSING | P3 | V1 |
| SCAN-RETRO-001 | Retroaktiv lönejustering i historik | MISSING | P2 | 3 |

## UX-detaljer (kvalitet)
| ID | Krav | Status | Prio | Fas |
|----|------|--------|------|-----|
| UX-FORM-001 | Logisk tab-ordning i formulär | MISSING | P2 | alla |
| UX-FORM-002 | Autofill iOS/Android | MISSING | P2 | alla |
| UX-FORM-003 | Numeriskt tangentbord på beloppsfält | MISSING | P1 | alla |
| UX-FORM-004 | Konsekvent datepicker (aldrig textinmatning för datum) | PARTIAL | P2 | alla |
| UX-FORM-005 | Auto-spara utkast var 30:e sek | MISSING | P2 | alla |
| UX-NOTIF-001 | Tyst timme (notisfönster av) | MISSING | P2 | 2 |
| UX-NOTIF-002 | Notis-sammanfattning (morgonsummering) | MISSING | P3 | 2 |
| UX-NOTIF-003 | Kritiska notiser kan ej stängas av | MISSING | P2 | 2 |

## Plattformssystem (Del 56) — CORE-motorer, mestadels framtid
| ID | Krav | Status | Prio | Fas |
|----|------|--------|------|-----|
| SYS-HUB-001 | Universal Object Hub (enhetlig objektvy) | DEFERRED_ARCHITECTURE_READY | P3 | V1 |
| SYS-SEARCH-001 | Universal Search + Command Palette (Cmd+K) | MISSING | P3 | 4 |
| SYS-NOTIF-001 | Notification Engine | PARTIAL (reminders) | P2 | 2 |
| SYS-RULES-001 | Rules Engine | DEFERRED_ARCHITECTURE_READY | P3 | V1 |
| SYS-AUTO-001 | Automation Engine + Event Bus | DEFERRED_ARCHITECTURE_READY | P4 | V1 |
| SYS-FORM-001 | Form & Custom Data Engine | DEFERRED_NOT_PREPARED | P4 | V1 |
| SYS-REPORT-001 | Reporting & Analytics Engine | DEFERRED_NOT_PREPARED | P4 | V1 |
| SYS-HEALTH-001 | System Health & Maintenance Center | DEFERRED_NOT_PREPARED | P3 | V1 |
| SYS-INT-001 | Integration Hub | DEFERRED_NOT_PREPARED | P4 | V2 |
| SYS-ADAPT-001 | Adaptive Experience Engine | DEFERRED_NOT_PREPARED | P4 | FUTURE |
| SYS-MEM-001 | Memory Engine / Decision Center / Future Capsule | DEFERRED_NOT_PREPARED | P4 | FUTURE |

**Not:** Universal Object Hub (SYS-HUB-001) är ett starkt mönster — när vi bygger
detaljsidor bör de följa Hub-strukturen från start så vi slipper bygga om till
parallella sidor. Läggs som designregel när UI-lagret börjar.
