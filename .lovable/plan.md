# Implementation Plan: Del 8–17 (Business OS + Glow Up Life Hub)

## Scope
Bygg Del 8 (ERP/Ekonomi), Del 9 (Kunskap), Del 10 (Relationship OS), Del 11 (Analytics/Mission Control), Del 12 (Beslutsanalys), Del 13 (Automation), Del 14 (Multi-Company/Koncern), Del 15 (Polish), Del 16 (Security/GDPR/Audit), Del 17 (Life Hub) som ett sammanhängande system. Slå ihop överlappande system istället för att duplicera.

## Guardrails (gäller allt)
- Deterministiskt först, AI endast där explicit tillåtet (Life Insights, Trend Engine v2). Ingen AI i core beslutsflöde.
- Behåll platform-agnostiskt schema, soft-delete på orders, Stripe SSOT, RLS + GRANT på alla nya publika tabeller, `has_role`/`is_staff` för policies.
- Ingen ny personlig data-tabell utan GDPR-plan (export + radering).
- Slå ihop `staff_tasks` + `work_items` → ETT task-system (behåll `work_items`, migrera `staff_tasks` in). Löser konflikt #2.
- Endast SV i admin, monokrom design, Plus Jakarta Sans/Inter, 0.75rem radius.
- Payment Isolation: analytics/automation läser aldrig direkt från Stripe-flödet, endast från `orders`.

## Konfliktbeslut (låsta för denna implementation)
1. **AI**: deterministisk baseline + AI-lager på topp där explicit angivet (Insights, Trends). Ingen AI i Core.
2. **Tasks**: `work_items` behålls, `staff_tasks` migreras och tas bort.
3. **Multi-tenant**: `business_accounts` blir root, alla nya tabeller får `business_account_id` + RLS via `has_business_access(uid, business_id)`.
4. **Payment Isolation**: bibehålls; nya moduler läser aggregat, ej Stripe direkt.
5. **GDPR**: löses i Sprint 6 innan Life Hub (Sprint 7) släpps live.
6. **Life Hub placement**: egen Sprint 7 efter Relationship OS + GDPR.

## Sprintordning

### Sprint 1 — ERP & Ekonomi (Del 8)
- Tabeller: `ledger_entries`, `invoices`, `expenses`, `suppliers`, `purchase_orders`, `cash_positions`.
- Edge functions: `erp-book-order` (trigger vid Stripe paid), `erp-reconcile`, `erp-export-sie` (SIE4).
- Admin UI: `/admin/erp` med Resultat, Balans, Kassaflöde, Leverantörer, Inköp.
- Kopplar Stripe SSOT → automatisk bokföring via order events.

### Sprint 2 — Kunskap (Del 9)
- Tabeller: `knowledge_articles`, `knowledge_categories`, `knowledge_tags`, `article_versions`, `article_translations`.
- Reuse `product_tag_relations`-mönster.
- Public routes `/kunskap/*` + admin `/admin/kunskap`.
- SEO: JSON-LD Article, canonical, sitemap.
- Koppling produkt ↔ artikel via `product_knowledge_links`.

### Sprint 3 — Relationship OS (Del 10)
- Konsolidera: `profiles`, `orders`, `reviews`, `referrals` → unified Customer 360.
- Nya tabeller: `customer_segments`, `customer_notes`, `customer_touchpoints`, `lifecycle_stages`.
- Edge: `relationship-recompute-segment` (nightly cron).
- Admin UI: `/admin/kunder/:id` timeline (order, review, referral, touchpoint, support).
- Deterministiska segment (RFM), ingen AI.

### Sprint 4 — Mission Control Analytics (Del 11 + 12)
Slås ihop eftersom Del 12 är beslutslagret ovanpå Del 11.
- Materialized views: `mv_daily_revenue`, `mv_product_velocity`, `mv_cohort_retention`, `mv_funnel_stages`.
- Cron: `analytics-refresh-hourly`, `analytics-refresh-nightly`.
- Tabeller: `insights`, `recommended_actions`, `anomaly_events`.
- Admin UI: `/admin/mission-control` — svarar "Vad hände / Varför / Vad göra / Vad inte göra".
- AI (Lovable AI Gateway `google/gemini-3-flash-preview`) endast för Insight-generering med deterministisk data som input. Fallback = deterministiska regler.

### Sprint 5 — Automation (Del 13) + Koncern (Del 14)
- Bygg vidare på `automation_rules` + `automation_logs`.
- Nya: `automation_workflows` (flerstegs), `workflow_runs`, `workflow_approvals`.
- Trigger-typer: order.paid, stock.low, review.new, customer.at_risk, cron.
- Actions: send_email (befintlig kö), create_task (work_items), adjust_stock, notify_staff, book_ledger.
- Level 1–3 autonomi enligt Del 13. Level 4 flaggat men ej aktiverat.
- Del 14: `business_accounts` blir root, `inter_company_transfers`, `shared_resources`, unified login-switcher. Alla nya tabeller från Sprint 1–4 backfillas med `business_account_id`.

### Sprint 6 — Security, GDPR, Audit, Polish (Del 15 + 16)
- GDPR: `gdpr-export-user` + `gdpr-delete-user` edge functions, cookie-policy, samtyckesloggar.
- Audit: utvidga `access_audit_log` till alla nya moduler; retention 12 mån.
- RLS-sweep på alla Sprint 1–5-tabeller, linter clean.
- HIBP + rate limiting på auth.
- UI-polish: konsistent design tokens, tomma states, laddskelett, felmeddelanden på svenska.

### Sprint 7 — Glow Up Life Hub (Del 17)
- Tabeller: `life_goals`, `life_routines`, `life_reminders`, `journal_entries`, `product_usage_logs`, `life_dashboard_state`.
- Alla `user_id`-scoped, RLS strikt ägar-only, ingen delning.
- UI: `/mitt-liv` med Goal Engine, Routine Builder, Reminders, Journal, Product Tracking, Life Dashboard.
- Knowledge Journey-koppling till Sprint 2.
- Life Insights: AI valfri, deterministisk fallback default.
- Gamification (streaks/levels) via befintligt mönster.

## Sammanslagningar (för att undvika duplicering)
- `staff_tasks` → `work_items` (Sprint 1, migrering).
- Del 11 + Del 12 → gemensam Mission Control (Sprint 4).
- Del 13 automation återanvänder `automation_rules` (bygger ut, ersätter ej).
- Del 14 multi-company retrofit på ALLA tabeller från Sprint 1–4 samtidigt (inte separata migreringar per del).
- Del 15 polish sker inline i Sprint 6, inte separat.
- Life Hub Product Tracking återanvänder `wishlists` + `orders`, ny tabell endast för dagligt bruk-loggning.

## Tekniska detaljer
- Migrations: en per sprint, alla med CREATE TABLE + GRANT + RLS + POLICY i samma fil.
- Edge functions: Deno, `npm:` imports, CORS, JWT-verifiering i kod, Zod-validering, korrekt felhantering.
- AI: endast Lovable AI Gateway, model `google/gemini-3-flash-preview`, `LOVABLE_API_KEY` server-side, deterministisk fallback obligatorisk.
- Ingen touch på `auth`, `storage`, `realtime`-scheman eller autogenererade filer.
- Frontend: React 18 + Vite + Tailwind, semantiska tokens från `index.css`, shadcn-komponenter.

## Stopp-kriterier (bara då jag pausar och frågar)
1. Del 14 kräver att koncern-root vs single-tenant bekräftas: default = koncern-root, retrofit alla tabeller. Om detta är fel — säg till.
2. Del 17 Life Hub — bekräfta att `google/gemini-3-flash-preview` via Lovable AI Gateway är ok för Life Insights (fallback deterministisk).
3. Level 4 autonomi (Del 13) aktiveras EJ automatiskt — kräver ditt godkännande innan det slås på.
4. Om en Stripe live-migrering krävs pausar jag.

Om inget av ovan triggas kör jag Sprint 1 → 7 sammanhängande utan att stanna.

## Leverabler efter varje sprint
- Migrationer godkända och körda.
- Edge functions deployade.
- Admin/publika routes länkade.
- Kort statusrad i chatten innan nästa sprint startar.
