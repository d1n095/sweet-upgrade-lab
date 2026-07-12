# MY MONEY MASTER — GAP-RAPPORT

> Bevisbaserad gap-analys. Kompletterar REQUIREMENTS_LEDGER.md (137 krav).
> Alla filvägar relativa projektroten. DB-tabeller = Supabase public-schema.

## SAMMANFATTNING I SIFFROR

| Mått | Antal |
|------|-------|
| **Totalt registrerade krav** | 137 |
| Verifierat färdiga (VERIFIED_COMPLETE) | 3 |
| Byggda men ej testade end-to-end | 33 |
| Halvklara (PARTIAL) | 31 |
| Saknas helt (MISSING) | 42 |
| Framtid, arkitektur förberedd | 3 |
| Framtid, ej förberedd | 24 |
| Ej möjligt i nuvarande plattform | 1 |
| Felplacerade / dubbletter / konflikter (kod) | se nedan |

**Ärlig läsning:** endast 3 krav är verkligt verifierade (RLS, midnattspass, OB-breakdown).
Merparten (33) är byggd men otestad — koden finns men kedjan är inte bevisat hel.
Det är INTE samma sak som "klart". 42 krav saknas helt, varav ~half är framtidsvision.

---

## 1. FULLSTÄNDIG MODULMATRIS (kedjekontroll)

Kedja: DB → RLS → backend → validering → UI → flöde → fel → mobil.
✓ = finns, ~ = delvis, ✗ = saknas, — = ej relevant.

| Modul | DB | RLS | Backend | Valid. | UI | Flöde | Fel | Mobil |
|-------|----|----|---------|--------|----|----|-----|-------|
| Auth | ✓ | ✓ | ✓ | ~ | ✓ | ~ | ~ | ~ |
| Arbetsprofiler | ✓ | ✓ | ✓ | ~ | ✓ | ~ | ~ | ~ |
| Pass (shifts) | ✓ | ✓ | ✓ | ~ | ✓ | ~ | ~ | ~ |
| Lönemotor (OB/jour) | ✓ | ✓ | ✓ | ~ | ✓ | ~ | ~ | ~ |
| Schema-scanner | ✓ | ✓ | ✓ | ~ | ✓ | ~ | ~ | ~ |
| Löneperiod | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Lönespec | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Dokumentvault | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Ekonomi/utgifter | ✓ | ✓ | ~ | ~ | ✓ | ~ | ~ | ~ |
| Skulder | ✗ | — | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Budget/prognos | ~ | ✓ | ~ | ✗ | ~ | ✗ | ✗ | ✗ |
| Kalender | ✓ | ✓ | ✓ | ~ | ✓ | ~ | ~ | ~ |
| Planering | ✓ | ✓ | ✓ | ~ | ✓ | ~ | ~ | ~ |
| Signaler/insikter | ✓ | ✓ | ~ | ~ | ✓ | ~ | ~ | ~ |
| Timeline | ✓ | ✓ | ~ | — | ~ | ~ | ~ | ~ |
| Dashboard | ~ | ✓ | ~ | — | ✓ | ~ | ~ | ~ |

---

## 2. SAKNAS HELT (MISSING) — 42 krav, urval av de viktigaste

**Scanner (det du prioriterar):**
- SCAN-CLASS-001 dokumentklassificering — scannern antar alltid "schema" (`importera.tsx`)
- SCAN-PAYSLIP-001 lönespec-scanning — finns inte
- SCAN-FEEDBACK-001 lönespec→inställningar — finns inte
- SCAN-GHOST-001 spökpass-skydd — ingen self-import-detektion
- SCAN-ORIG-001 spara originalfil — OCR sparar inte i `documents`
- SCAN-FALL-001 fallback om AI nere — kastar bara fel

**Lön:**
- WORK-EARN-001 intjänat≠utbetalt-widgets · WORK-CMP-001 jämför lön · WORK-DEV-001 avvikelsevarningar · WORK-OT-002 mertid

**Ekonomi:** FIN-DEBT-001 skulder · FIN-ACC-001 konton · FIN-FCT-001 prognos · FIN-INS-001 försäkringar · FIN-ASSET-001 tillgångar

**Kärna:** CORE-GDPR-001/002 export+radera · CORE-AUDIT-001 audit-logg · CORE-OFFLINE-001 offline

**Livsplanering:** LIFE-ROUT-001 rutiner · LIFE-GOAL-001 mål · LIFE-STREAK-001 streaks (+ hälsa/kost/vikt/sömn, mestadels framtid)

---

## 3. HALVBYGGDA (PARTIAL) — 31 krav, kritiska urval

- CORE-AUTH-004 session — persistSession ej verifierad (F5-risk)
- CORE-SEC-002 service-role i klient — EJ granskat denna revision (P0 att kolla)
- SCAN-DUPE-001 dubblettskydd — finns i `conflicts.ts` men bara tidsöverlapp, ej fullt
- SCAN-CONF-001 confidence — per rad, ej per fält
- WORK-NET-001 nettolön — `planning/tax.ts` finns, ej verifierad
- DOC-VAULT-001 vault — DB+storage klart, ingen UI/route
- FIN-DEBT/BUD — referenser utan tabeller

---

## 4. DUBBLETTER

**I spec:**
- **DUP-SPEC-001:** TVÅ "Del 65" i `MY_MONEY_MASTER_SPEC_V3.md` — rad 6377 "PRODUKTGRANSKNING: SKÄRM FÖR SKÄRM" OCH rad 6584 "KANONISKT ALPHA-SCHEMA". Måste omnumreras (den senare → Del 66).

**I kod:** inga tabell-/trigger-/policy-dubbletter hittade. Migration UPGRADE_01 verifierad mot omkörning.

**Konceptuell dubblett (löst):**
- **DUP-DATA-001:** lön på BÅDE `profiles` och `work_profiles`. Löst i UPGRADE_01 Del A (profiles-fält märkta legacy, data migrerad). Kräver KOD-ändring: sluta läsa `profiles.hourly_rate`.

---

## 5. FELPLACERADE

- **MIS-001:** `profiles.hourly_rate/tax_rate/ob_rules` — lön hör till anställning, inte person. Åtgärdas när koden slutar läsa dem (REQ: se backlog PKT-02).
- **MIS-002:** OCR-original sparas inte i dokumentmodellen — scannern lever isolerat från `documents`. Bör integreras (backlog PKT-05).

---

## 6. TEKNISKA RISKER

- **RISK-T1:** UPGRADE_01 ej körd mot live-DB. Grammatik + idempotens verifierad lokalt, men Supabase-specifika extensions (storage.foldername) måste testas i din instans.
- **RISK-T2:** Soft delete tillagt på `shifts`, men befintliga queries (t.ex. `importera.tsx`, `jobb.tsx`, kalender) filtrerar INTE `deleted_at IS NULL` än → raderade pass kan visas. KRÄVER kodpass (backlog PKT-03).
- **RISK-T3:** OCR beroende av `LOVABLE_API_KEY` + Gemini. Ingen fallback, ingen kostnadstak, ingen retry. Nere = scanner död.
- **RISK-T4:** Ingen automatisk pay_period-generering — `pay_periods` är tom tabell utan logik som fyller den.
- **RISK-T5:** TanStack Start / Bun — inte standard-Lovable. Vissa Lovable-prompter kan anta React Router och krocka.

---

## 7. SÄKERHETS- & INTEGRITETSRISKER

- **RISK-S1 (löst i UPGRADE_01):** dokument-storage saknade bucket + policies → nu privat bucket + per-användare-policies via `storage.foldername`.
- **RISK-S2:** CORE-SEC-002 service-role-nyckel i klient — EJ verifierad. Måste kontrolleras före lansering (P0).
- **RISK-S3:** Ingen audit-logg (CORE-AUDIT-001) — känsligt särskilt om multi-tenant/LSS aktiveras.
- **RISK-S4:** GDPR export/radering saknas (CORE-GDPR-001/002) — lagkrav före publik lansering i EU.
- **RISK-S5:** OCR skickar bilder till Gemini (Lovable AI Gateway) — dokumentera i privacy-policy; känsliga dokument (ID, lönespec) lämnar enheten. Mot Del 3 "Privacy by Design" krävs tydligt samtycke.

---

## 8. FRAMTIDSFUNKTIONER UTAN FÖRBEREDD ARKITEKTUR (24 st)

Multi-tenant (ORG-*), Business OS/CRM/bokning/marketplace (BIZ-*), hälsa/kost/vikt/sömn/beroende (LIFE-*), hem/renovering/energi (HOME-*), prisjämförelse/partnerapp (FIN-*).
**Gemensam aktiveringsväg:** kräver först ORG-TENANT-001 (tenant-isolering ovanpå nuvarande RLS) innan de organisationsnära byggs. Konsumentnära (hälsa etc.) kräver bara nya moduler ovanpå objektmodellen — ingen kärnombyggnad.

## 9. KRAV I ÄLDRE MATERIAL MEN EJ I SENASTE FLÖDET

- Demo-läge utan inloggning (Del 30) — ej i ledger-fokus, finns i spec, ej byggt.
- Seed-data (Del 30) — ej byggt.
- API-versionering (Del 31) — ej relevant förrän publikt API.
- 12 säkerhetsnivåer (Del 17) — förenklat till RLS-nivå i praktiken.

## 10. KONFLIKTER SOM KRÄVER DITT PRODUKTBESLUT

- **BESLUT-1:** `profiles`-lönefälten — droppa dem nu (ren men irreversibel) eller behåll som legacy tills koden är omskriven (säkrare)? *Rekommendation: behåll legacy tills PKT-02 klar.*
- **BESLUT-2:** OCR-integritet — ska känsliga dokument (ID, lönespec) alls skickas till moln-AI, eller bara scheman? Påverkar SCAN-PAYSLIP-001.
- **BESLUT-3:** Multi-tenant (LSS/kommun) — är detta en riktig nära plan eller långsiktig vision? Avgör om ORG-TENANT-001 ska prioriteras upp (påverkar hela säkerhetsmodellen).
- **BESLUT-4:** Plattform — fortsätta i Lovable trots TanStack/Bun-stacken, eller är det en signal att koden vuxit förbi ren prompt-byggnad?
