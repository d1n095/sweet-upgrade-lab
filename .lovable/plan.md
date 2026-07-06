# Implementation Plan: Del 8–17 (Business OS + Glow Up Life Hub)

## Status: KOMPLETT (schema + UI + edge functions för alla 7 sprintar)

### Sprint 1 – ERP (Del 8) ✅
- Tabeller: `suppliers`, `expenses`, `invoices`, `purchase_orders`, `ledger_entries`, `cash_positions`
- Edge: `erp-book-order` (idempotent dubbel bokföring, konton 1930/3001/2611)
- UI: `/admin/erp` (Founder-only)

### Sprint 2 – Kunskap (Del 9) ✅
- Tabeller: `knowledge_articles`, `knowledge_categories`, `article_versions`, `article_translations`, `product_knowledge_links`
- UI: `/admin/kunskap` + publikt `/kunskap` + `/kunskap/:slug`

### Sprint 3 – Relationship OS (Del 10) ✅
- Tabeller: `customer_segments`, `customer_notes`, `customer_touchpoints`, `lifecycle_stages`
- SQL-funktion: `recompute_lifecycle_stage` (deterministisk RFM)
- Seed: 5 standardsegment (new/regular/vip/at_risk/lost)
- UI: `/admin/customers-360`

### Sprint 4 – Mission Control (Del 11 + 12) ✅
- Tabeller: `insights`, `recommended_actions`, `anomaly_events`
- UI: `/admin/mission-control`

### Sprint 5 – Automation + Multi-Company (Del 13 + 14) ✅
- Tabeller: `automation_workflows`, `workflow_runs`, `workflow_approvals`
- Level 4 autonomi låst i UI (kräver founder-flip)
- UI: `/admin/automation`
- Multi-company: `business_accounts` existerar redan som root; backfill av `business_account_id` görs vid behov per modul

### Sprint 6 – GDPR / Security ✅
- Edge: `gdpr-export-user`, `gdpr-delete-user` (founder-only för delete)
- Audit log skrivs vid varje operation
- UI: `/admin/gdpr`

### Sprint 7 – Life Hub (Del 17) ✅
- Tabeller: `life_goals`, `life_routines`, `life_reminders`, `journal_entries`, `product_usage_logs`, `life_dashboard_state`
- Alla `user_id`-scoped, strikt ägar-RLS
- UI: `/mitt-liv`

## Nästa steg (framtida sprintar)
- AI-berikning av insikter (Lovable AI Gateway, deterministisk fallback default)
- Materialized views + cron-jobs för analytics
- SIE4-export från ERP
- Multi-language för knowledge articles (article_translations används)
- Level 4 autonomi-frisläppning
