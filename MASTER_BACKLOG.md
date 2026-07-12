# MY MONEY MASTER — MASTER-BACKLOG

> Hela visionen uppdelad i genomförbara byggpaket. Ordnad så att kärnan
> aldrig behöver byggas om för framtida funktioner. Varje paket:
> scope · filer · migrationer · beroenden · acceptans · test · risk · rollback · Lovable-komplexitet.
>
> Komplexitet 1–5 (Lovable-credits/svårighet). Risk L/M/H.

---

## FAS 0 — STABILISERA & SÄKRA (blockerare)

### PKT-00 — Kör & verifiera UPGRADE_01_grunden.sql
- **Scope:** Applicera migrationen i Supabase, verifiera alla 7 tabeller + storage-bucket.
- **Filer:** `supabase/migrations/UPGRADE_01_grunden.sql`
- **Migrationer:** denna
- **Beroenden:** inga
- **Acceptans:** migrationen körs 2 ggr utan fel; storage-bucket "documents" finns och är privat; en testfil kan bara läsas av ägaren.
- **Test:** kör om migrationen; ladda upp fil som user A, försök läsa som user B → nekas.
- **Risk:** M (storage-policies plattformsspecifika) · **Rollback:** migrationen rör inget destruktivt; nya tabeller kan droppas.
- **Komplexitet:** 1

### PKT-01 — Verifiera auth-kedjan end-to-end
- **Scope:** Bekräfta AUTH-001..004 + SEC-002 fungerar och session överlever F5.
- **Filer:** `routes/auth*.tsx`, Supabase-klient-init
- **Beroenden:** —
- **Acceptans:** registrera→verifiera→logga in→F5→förblir inloggad; glömt lösenord fungerar; ingen service-role-nyckel i klientbundle.
- **Test:** hela auth-flödet manuellt + sök bundle efter service_role.
- **Risk:** L · **Rollback:** — · **Komplexitet:** 2

### PKT-02 — Sluta läsa lön från profiles (klart One Source of Truth)
- **Scope:** All kod läser lön från `work_profiles`, aldrig `profiles`.
- **Filer:** sök `profiles.hourly_rate|tax_rate|ob_rules` i `src/`
- **Beroenden:** PKT-00 (datamigrering gjord)
- **Acceptans:** ingen kodreferens till profiles-lönefält; lön visas identiskt före/efter.
- **Test:** grep bekräftar noll referenser; löneuträkning oförändrad.
- **Risk:** M · **Rollback:** legacy-fält finns kvar → återställ läsning · **Komplexitet:** 2

### PKT-03 — Soft delete respekteras i alla queries
- **Scope:** Alla `shifts`-queries filtrerar `deleted_at IS NULL`.
- **Filer:** `importera.tsx`, `jobb.tsx`, `kalender.tsx`, salary-moduler
- **Beroenden:** PKT-00
- **Acceptans:** raderat pass syns ingenstans; papperskorg möjlig senare.
- **Test:** soft-delete ett pass → borta i alla vyer.
- **Risk:** M (lätt att missa en query) · **Rollback:** — · **Komplexitet:** 2

---

## FAS 1 — ARBETE & LÖN (alpha-kärna)

### PKT-04 — Löneperiod-motor
- **Scope:** Auto-generera `pay_periods` från profilens `pay_period_start_day`; koppla varje pass till rätt period; beräkna nästa utbetalningsdatum.
- **Filer:** ny `modules/salary/periods.ts`; `jobb.tsx`
- **Migrationer:** — (tabeller finns via UPGRADE_01)
- **Beroenden:** PKT-00
- **Acceptans:** pass 16→15 hamnar i rätt period; utbetalningsdatum korrekt (offset).
- **Test:** skapa pass över periodgräns → hamnar rätt.
- **Risk:** M · **Rollback:** ta bort periods.ts · **Komplexitet:** 3

### PKT-05 — Intjänat ≠ utbetalt på dashboard
- **Scope:** Två separata widgets: "intjänat denna period" och "nästa löneutbetalning".
- **Filer:** `dashboard.tsx`, `modules/salary/periods.ts`
- **Beroenden:** PKT-04
- **Acceptans:** talen skiljer sig korrekt; rätt periodetiketter.
- **Test:** jämför mot handräkning.
- **Risk:** L · **Rollback:** dölj widgets · **Komplexitet:** 2

### PKT-06 — Extrapass med egna löneregler
- **Scope:** `shift_category` styr vilka `ob_rules` som gäller (multiplikator per pass).
- **Filer:** `ob.ts`, `compute.ts`, `jobb.tsx`
- **Beroenden:** PKT-00
- **Acceptans:** extra-pass (t.ex. 2.4×) räknas rätt; motorn visar vilken kategori/regel.
- **Test:** extra-pass ger annat belopp än ordinarie.
- **Risk:** M · **Rollback:** ignorera shift_category · **Komplexitet:** 3

---

## FAS 3 — SCANNER (din prioritet)

### PKT-07 — Spara originaldokument + storage-integration
- **Scope:** OCR laddar upp originalet till `documents` (privat bucket) FÖRST.
- **Filer:** `lib/schedule-ocr.functions.ts`, `importera.tsx`, ny `documents`-hjälpare
- **Beroenden:** PKT-00
- **Acceptans:** varje scan skapar en `documents`-rad; originalet nedladdningsbart via signed URL.
- **Test:** scanna → originalfil finns kvar och öppnas.
- **Risk:** M · **Rollback:** hoppa över spara-steg · **Komplexitet:** 3

### PKT-08 — Dokumentklassificering
- **Scope:** Avgör schema/payslip/receipt/... regelbaserat först, AI som stöd; visa gissad typ, låt användaren bekräfta.
- **Filer:** ny `modules/scan/classify.ts`, `importera.tsx`, `schedule-ocr.functions.ts`
- **Beroenden:** PKT-07
- **Acceptans:** lönespec klassas ≠ schema; osäker typ → fråga, ej auto-import.
- **Test:** ladda schema, lönespec, kvitto → rätt typ var gång.
- **Risk:** M · **Rollback:** default till schema · **Komplexitet:** 4

### PKT-09 — Spökpass-skydd + import-batch + ångra
- **Scope:** Self-import-varning; varje import = `import_batch`; hela batchen ångringsbar.
- **Filer:** `importera.tsx`, `classify.ts`, ny importhistorik-vy
- **Beroenden:** PKT-08
- **Acceptans:** screenshot av egen app → varning; dubbletter fångas; ångra tar bort hela batchen (soft delete).
- **Test:** importera schema 2 ggr → dubbletter; ångra → allt borta.
- **Risk:** M · **Rollback:** behåll nuvarande direkt-skapande · **Komplexitet:** 4

### PKT-10 — Lönespec-scanning + återkoppling
- **Scope:** Payslip-OCR → spara i `payslips` → föreslå OB-regler/timlön/profil (aldrig auto).
- **Filer:** ny `modules/scan/payslip.ts`, `schedule-ocr.functions.ts`, settings-UI
- **Beroenden:** PKT-08, PKT-04
- **Acceptans:** scannad lönespec föreslår inställningar; inget auto-sparas.
- **Test:** scanna lönespec → förslag dyker upp, bekräftas manuellt.
- **Risk:** M · **Rollback:** dölj payslip-flöde · **Komplexitet:** 4

### PKT-11 — Lönespec-jämförelse (Payday-kärna)
- **Scope:** Jämför scannad lönespec mot appens uträkning per period; flagga "möjlig avvikelse".
- **Filer:** ny `modules/salary/reconcile.ts`, dashboard/payday-vy
- **Beroenden:** PKT-10, PKT-04
- **Acceptans:** differenser visas neutralt; aldrig "arbetsgivaren gjorde fel".
- **Test:** lägg in avvikande lönespec → flaggas.
- **Risk:** L · **Rollback:** dölj jämförelse · **Komplexitet:** 3

---

## FAS 2 — MVP-BREDD (efter kärnan)

### PKT-12 — Dokumentvault-UI
- **Scope:** Route + UI för `documents`: ladda upp, tagga, utgångsdatum, sök.
- **Beroenden:** PKT-07 · **Komplexitet:** 3 · **Risk:** L
- **Acceptans:** ladda upp/öppna/söka dokument; utgångspåminnelse skapas.

### PKT-13 — Ekonomi: skulder + budget
- **Scope:** `debts`-tabell + budget-modell + vyer i `pengar.tsx`.
- **Migrationer:** ny (debts, budget) · **Beroenden:** — · **Komplexitet:** 3 · **Risk:** L

### PKT-14 — GDPR: export + radera konto
- **Scope:** Exportera all användardata (JSON/zip); radera konto+data.
- **Beroenden:** — · **Komplexitet:** 3 · **Risk:** M (måste vara komplett)
- **Acceptans:** export innehåller alla tabeller; radering tömmer allt via CASCADE.

### PKT-15 — Fixa spec-dubbletten Del 65
- **Scope:** Omnumrera andra "Del 65" (Kanoniskt alpha-schema) → Del 66.
- **Filer:** `MY_MONEY_MASTER_SPEC_V3.md` · **Komplexitet:** 1 · **Risk:** L

---

## FAS 4 — DASHBOARD & IA (retroaktivt)

### PKT-16 — Widget-system + Quick Add + Cmd+K
- **Scope:** Dashboard som centrum (Del 61): flyttbara widgets, global +, universal search.
- **Beroenden:** kärnmoduler klara · **Komplexitet:** 5 · **Risk:** M

---

## FRAMTID (V1/V2) — arkitektur-grindar

Byggs INTE nu. Ordningskrav för att slippa bygga om kärnan:

1. **ORG-TENANT-001 (tenant-isolering)** MÅSTE komma före allt organisationsnära
   (kommun/LSS/personalportal/white-label/licensiering). Bygger ovanpå nuvarande
   RLS med en tenant_id-nivå. Komplexitet 5, Risk H.
2. **Konsumentnära moduler** (hälsa, kost, vikt, sömn, vanor, mål, gamification,
   hem/inventarier, prisjämförelse) kräver INGEN kärnombyggnad — nya moduler mot
   objektmodellen. Kan byggas oberoende när önskas.
3. **Bankkoppling (FIN-BANK-001)** kräver extern PSD2/Tink + säker backend —
   NOT_POSSIBLE_IN_CURRENT_PLATFORM utan tillägg.
4. **Business OS / CRM / bokning / marketplace** bygger på tenant + objektmodell.

---

## REKOMMENDERAD ORDNING (sammanfattning)

PKT-00 → 01 → 02 → 03 (stabilisera)
→ 04 → 05 → 06 (löneperiod + intjänat/utbetalt + extrapass)
→ 07 → 08 → 09 → 10 → 11 (scanner: original→klass→spökskydd/ångra→lönespec→jämförelse)
→ 12 → 13 → 14 → 15 (vault, ekonomi, GDPR, spec-städ)
→ 16 (dashboard/IA)
→ framtidsgrindar efter behov.

Denna ordning gör att scanner-arbetet (din prioritet) vilar på en stabil,
städad kärna, och att ingen framtidsfunktion tvingar fram en ombyggnad.
