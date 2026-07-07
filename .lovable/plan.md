# Masterplan Backlog – Del 8–17

Statusnycklar: ✅ Klar · 🟡 Delvis klar · ⛔ Inte påbörjad
Regel: Varje uppgift körs i en egen körning. När en är klar går nästa igång automatiskt. Inget hoppas över p.g.a. storlek — för stora items delas i deluppgifter (a/b/c).

---

## Sammanfattning nuläge

Schema (tabeller + RLS) och skalroute + minimal read-only UI finns för alla 7 sprintar. Edge-funktioner finns endast för ERP-bokning och GDPR export/delete. Merparten av interaktion (skapa/redigera/köra), affärslogik, cron/materialiserade views, AI-berikning, SIE4, multi-language, Level 4-autonomi och djupare integrationer saknas.

---

## Prioriterad backlog

### P0 – Business-kritiska luckor (måste klart först)

1. ⛔ **ERP – bokföringsjournal-UI**: lista `ledger_entries` med filter (konto/datum), verifikationsdrilldown, saldon per konto.
2. 🟡 **ERP – leverantörer & inköp CRUD**: `suppliers`, `purchase_orders`, `expenses` – skapa/redigera/attesta i UI.
3. ⛔ **ERP – SIE4-export**: edge-funktion `erp-export-sie4` som streamar SIE4 för valt räkenskapsår.
4. ⛔ **ERP – fakturaflöde**: `invoices` UI + PDF-generering + status (utkast/skickad/betald/förfallen) + koppling till order.
5. ⛔ **ERP – kassaflöde-vy**: `cash_positions` daglig snapshot, cron `erp-cash-snapshot` + graf.
6. 🟡 **Kunskap – artikelredigerare**: rik-textredigerare, versionering (`article_versions`), publiceringsflöde utkast→granskad→publicerad.
   - 6a Editor UI + spara utkast
   - 6b Versionsspår + återställning
   - 6c Publish/unpublish + slug-validering
7. ⛔ **Kunskap – kategorier CRUD** i `/admin/kunskap` (skapa/ordna/dölja).
8. ⛔ **Kunskap – produkt-länkning**: `product_knowledge_links` UI från både produkt- och artikelsidan; publik visning på produktsidan.
9. ⛔ **Kunskap – översättningar (SV/EN)**: `article_translations` UI, publik `/kunskap` respekterar språk.
10. 🟡 **Customer 360 – segment-tilldelning**: cron `lifecycle-recompute` som kör `recompute_lifecycle_stage` nattligt.
11. ⛔ **Customer 360 – touchpoint-timeline**: samlad tidslinje (order, mail, kontakt, recension) per kund.
12. ⛔ **Customer 360 – anteckningar CRUD** (`customer_notes`) med sync till admin.
13. ⛔ **Mission Control – insikt-generator**: cron `insights-generate` (deterministisk: låg lager, sjunkande försäljning, anomalier via z-score på `product_sales`).
14. ⛔ **Mission Control – actions-flöde**: acceptera/avfärda `recommended_actions`, koppla mot ansvarig (`staff_tasks`).
15. ⛔ **Mission Control – anomalidetektor**: cron `anomaly-detect` skriver `anomaly_events` (orderfrekvens, avvisade betalningar, stock-drift).
16. ⛔ **Automation – workflow-editor**: bygg trigger→condition→action-editor för `automation_workflows`.
17. ⛔ **Automation – runner (Level 1–3)**: edge `workflow-run` som kör steg, loggar `workflow_runs`, respekterar `workflow_approvals` för Level 2/3.
18. ⛔ **Automation – godkännandekö-UI**: staff-approve/deny på `workflow_approvals`.
19. ⛔ **Automation – Level 4-frisläppning**: founder-gated toggle + audit-inlägg vid aktivering.
20. 🟡 **GDPR – begäransekö**: tabell `gdpr_requests` (om saknas) + UI som listar öppna requests innan edge körs.
21. ⛔ **GDPR – självservice på `/profile`**: knappar för egen export/radering som anropar edge-funktioner.
22. 🟡 **Life Hub – mål/rutiner/påminnelser CRUD** i `/mitt-liv` (skapa, checkoff, arkivera).
    - 22a `life_goals` CRUD + progress
    - 22b `life_routines` scheman + streak
    - 22c `life_reminders` skapa/snooze + notis
    - 22d `journal_entries` daglig anteckning
    - 22e `product_usage_logs` från order/produkt
23. ⛔ **Life Hub – dashboard-widgets**: `life_dashboard_state` styr vilka kort som visas; drag-to-reorder.

### P1 – Multi-company & data-integritet

24. 🟡 **Multi-company backfill**: skript/migration som fyller `business_account_id` på berörda tabeller (orders, invoices, expenses, ledger_entries, customers).
25. ⛔ **Multi-company selector** i admin-header (byta aktivt bolag) + RLS-filter per `business_account_id`.
26. ⛔ **Materialized views** för analytics: `mv_daily_sales`, `mv_customer_rfm`, `mv_stock_velocity` + `pg_cron`-refresh var 15 min.
27. ⛔ **Cron-registry**: en sida `/admin/automation` som listar alla `pg_cron`-jobb med senaste körning + status.

### P2 – AI-berikning (deterministisk fallback default)

28. ⛔ **AI-insikt-berikning**: valfri Lovable AI Gateway-anrop som lägger till förklarande text på `insights` när flaggan `ai_enrich_insights` är på; annars deterministisk mall.
29. ⛔ **AI-artikelutkast** i Kunskap-editorn (bakom flagga, tydligt märkt "utkast").
30. ⛔ **AI-kundsammanfattning** på Customer 360 (bakom flagga).

### P3 – Publik yta för Business OS-datan

31. ⛔ **Publik `/kunskap` redesign**: kategori-filter, sök, related products, SEO/JSON-LD Article.
32. ⛔ **Produktsidan visar relaterade guider** från `product_knowledge_links`.
33. ⛔ **`/mitt-liv` onboarding** för nya inloggade användare (3-stegs setup).

### P4 – Observability & drift

34. ⛔ **`/admin/mission-control` – system-hälsa-tab**: läser `system_health_checks`, visar SLA per edge-funktion.
35. ⛔ **Audit-vy för GDPR & Automation Level 4** (filtrerbar `access_audit_log`).
36. ⛔ **Test-täckning**: vitest-suite för `recompute_lifecycle_stage`, `erp-book-order` idempotens, `workflow-run` step-executor.

---

## Teknisk skuld & förbättringar (ej del av masterplan – körs efter P0–P4)

- TS1 Admin-sidorna använder små ad-hoc queries; bryt ut hooks per modul (`useErpLedger`, `useInsights`, …) för cache-återanvändning.
- TS2 `BusinessOSShowcase` bortlyft från publikt; komponenten själv kan flyttas till `src/components/admin/` och återanvändas i `/admin/business-os`.
- TS3 `AdminBusinessOS` och `AdminOverview` överlappar – slå ihop till ett admin-hem.
- TS4 Många edge-funktioner saknar delad zod-validering; introducera `_shared/validate.ts`.
- TS5 `plan.md` bör auto-uppdateras vid varje avslutad backlog-post (script).
- TS6 Tydliga typer för `insights.payload`, `anomaly_events.details`, `workflow_runs.step_log` (idag `Json`).

---

## Körordning

P0 uppgift 1 → 23 i nummerordning. Delade items (6a/6b, 22a–e) körs som separata körningar. Efter varje avslutad post: markera ✅ här och starta nästa. P1 börjar först när P0 är helt grönt. Skulden ovan rörs inte förrän hela masterplanen är ✅.
