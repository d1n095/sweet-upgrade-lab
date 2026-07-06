# Del 17 — Life Hub i Sprint 0

Del 17 introducerar **Life Hub** som ett nytt vertikalt lager ovanpå Business OS: användarens personliga kontrollcenter för mål, rutiner, framsteg och kunskapsresa. Del 16 fastställde Sprint 0–10 utan Life Hub — därför flaggas placering som konfliktbeslut.

Sprint 0-regeln gäller fortsatt: **inget byggs, ingen migration, inga user-privata data rörs.**

## Placeringsfråga (kräver ditt beslut)

Del 16:s officiella sprint-karta har ingen Life Hub-sprint. Två alternativ eskaleras i rapporten:

- **Alternativ A — Ny Sprint 11 (efter Polish):** Life Hub byggs efter att Core+Commerce+Knowledge+Relationship+ERP+Automation+Analytics+Security+Multi-Company+Polish är klara. Klassisk lager-för-lager-approach.
- **Alternativ B — Integrera i Sprint 3 + Sprint 4:** Life Hub Level 1 (Goal Engine, Routine Builder, Reminders, Life Library, Product Tracking, Life Dashboard) mappar naturligt mot Knowledge (Sprint 3) och Relationship OS (Sprint 4). Bygg Life Hub-koncept inbakat.

**Inget val fattas i Sprint 0.** Både alternativen dokumenteras med for/against, och beslutet fattas när Sprint 3-planen skrivs.

## Nytt Spår 18 — Life Hub Audit (mot Del 17)

Ingen personlig data läses på radnivå. Endast schema-check och aggregat.

### 18a. Personal Dashboard-status
- Finns per-user-dashboard idag (utöver stats/orders)? Grep `/dashboard`, `/account`, `/profile`, `/mypage`
- Vilka element av Del 17 (Mål/Rutiner/Produkter/Guider/Framsteg/Påminnelser/Favoriter/Anteckningar) finns?

### 18b. Goal Engine-status
- `goals`-tabell finns? Nej (bekräftat via Del 10-audit).
- Custom goals: helt gap.

### 18c. Routine Builder-status
- `routines`/`recipe_templates`/`recipe_ingredients` finns (schemat visar recipe-strukturer). Är dessa för produktrecept eller kundrutiner? Verifiera med read-only inspektion.
- Del 17-koncept (Morgon/Kväll/Vecka/Månad + egna steg): gap.

### 18d. Reminder Engine-status
- Customer Retention System-memory täcker refill-påminnelser ✓
- Utökade Del 17-påminnelser (rutin/produkt/guide/prebuy/lager/prenumeration/egna): gap
- Ingen ny cron ändras i Sprint 0.

### 18e. Progress Tracking + Streaks-status
- Streak/progress-fält på `profiles` idag? Grep.
- Ingen hälsodata krävs (Del 17-regel) — verifiera att befintlig data inte innehåller känsligt hälso-material.

### 18f. Life Journal (privata anteckningar)-status
- `notes`/`journal_entries`-tabell finns? Nej.
- Om beslutat framöver: kritiskt att RLS är strikt (endast ägare läser/skriver), krypterat vid vila om känsligt innehåll.

### 18g. Knowledge Journey-status
- `ai_read_log`, `interest_logs`, `search_logs`, `wishlists` — täcker de "vad har användaren läst/sparat/följt"?
- Del 17 kräver kontinuitet ("fortsätter där användaren slutade") — finns UI-element för detta? Troligen nej.

### 18h. Smart Recommendations-status
Samma mönster som Del 10 (Recommendation Engine). Deterministisk fallback via kategori/tag/ingredient-relationer möjlig utan AI. Life Insights-avsnitt är AI-flaggat → konflikt-notering (samma som Del 9–14).

### 18i. Product Tracking-status
- Del 17 kräver markering: Har köpt / Använder / Testar / Slutat / Favorit / Vill prova
- Idag: `wishlists` täcker "vill prova"; `orders` täcker "har köpt". Övriga states saknas.

### 18j. Life Library-status
- Sparade guider/checklistor/rutiner/artiklar/video/ordlista per user: alla saknar underliggande innehållsobjekt (Del 9-gap återspeglas här).

### 18k. Calendar-status
Level 2 — dokumentera enbart att kalender-vy inte finns.

### 18l. Privacy First-status (KRITISKT)
Del 17 är den mest privacy-känsliga modulen: journal, mål, rutiner, framsteg = mycket personlig data.

Verifiera att GDPR-baseline från Spår 11 (Del 10) och Spår 17 (Del 15) täcker:
- Export per user (per Del 17-krav)
- Radera (rensa historik)
- Stänga av rekommendationer (opt-out)
- Ingen marknadsföringsanvändning utan samtycke (samtyckesfält på `profiles`?)

Om GDPR-luckor finns → **blocker för Life Hub-sprinten oavsett placering.**

### 18m. Gamification & Community (roadmap)
Level 3. Dokumenteras enbart som ej-i-scope.

## Rapport-sektion i AUDIT_REPORT.md

Ny sektion **"Life Hub Gap Analysis (Del 17)"**:

1. Placerings-alternativ A vs B (with pros/cons per alternativ)
2. Dashboard/Goal/Routine/Reminder/Progress/Journal/Journey/Rec/Tracking/Library-mognadstabell
3. **Privacy First-verifiering** (kritisk — måste vara grön innan Life Hub byggs)
4. Deterministisk fallback för Smart Recommendations + Life Insights (No AI-linje)
5. Konflikt-notering: **Del 16 vs Del 17-placering** — kräver ditt beslut
6. Sprint-input (till antingen Sprint 3+4 eller ny Sprint 11 beroende på val)

## Konsoliderade Konflikter — uppdaterad

Från förra planen (5 konflikter) → nu **6 konflikter**:

1. AI vs No AI (Core-memory) — påverkar Del 9, 10, 11, 12, 13, 14, **17**
2. staff_tasks vs work_items — dubbelt task-system
3. Multi-tenant arkitektur (Del 14)
4. Payment Isolation-utökning (Del 11, 13, 15)
5. GDPR-blockers (om upptäckta) — påverkar Sprint 4, 7, **och Life Hub-sprinten**
6. **NYTT: Life Hub-placering** — ny Sprint 11 eller integrerad i Sprint 3+4

## Uppdaterad vågkörning

```text
Våg A: (oförändrat) Health · Perf · Duplication · Auto-inventering · Identity/Perm/Audit
Våg B: (+ Spår 18a–18e: Dashboard/Goal/Routine/Reminder/Progress-inventering)
Våg C: (+ Spår 18f–18m: Journal/Journey/Rec/Tracking/Library/Calendar/Privacy/Gamification)
Slut:  AUDIT_REPORT.md med Del 8–17-sektioner
```

Ingen ny våg, ingen extra tid.

## Guardrails oförändrade + tillägg

Alla G-S0-1..25 gäller. Tillägg:

- **G-S0-26** Ingen läsning av `notifications`/`interest_logs`/`ai_read_log`/`search_logs` på radnivå. Endast aggregat. Life Hub-datakällor är extra privacy-känsliga.
- **G-S0-27** Ingen ny personlig-data-tabell (goals/routines/journal/streaks) skapas eller migrerar under Sprint 0.
- **G-S0-28** Om GDPR-lucka upptäcks som blockerar Life Hub — flagga som blocker även om Life Hub byggs sist. Åtgärd senast i Sprint 4 (Relationship OS) eller Sprint 8 (Security), beroende på var GDPR-fixet naturligt hör hemma.

## Efter godkänd Sprint 0-rapport

Din Life Hub-placering (Alt A eller Alt B) fattas när Sprint 3-planen skrivs, INTE nu. Sprint 0-rapporten levererar underlaget så beslutet blir informerat.

Nivå 1 (Life Dashboard, Goal Engine, Routine Builder, Reminders, Life Library, Product Tracking) byggs bara efter din approval, konfliktbeslut om AI Insights, GDPR-verifiering och sprint-plan.

## Godkännande

Godkänner du denna uppdatering fortsätter Sprint 0 med Spår 18 tillagt. Life Hub är riktning, inte order. Inget byggs, ingen migration, ingen deploy — endast läs-only inventering, aggregerad statistik och rapport. Personlig data rörs inte.
