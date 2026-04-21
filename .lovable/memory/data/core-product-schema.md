---
name: core-product-schema
description: Canonical schema for products, product_stats, price_history, and stock_history with trigger-based audit rules
type: feature
---

# Core Product Schema

**Rule: never recreate these tables — they hold live production data.**

## Tables (all in `public`)

- **`products`** (59 cols) — catalog. Bilingual sv/en. Pricing (`price`, `cost_price`, `original_price`, `currency='SEK'`). Inventory (`stock`, `reserved_stock`, `low_stock_threshold=5`, `restock_amount=50`, `units_sold_7d/30d`, `last_sold_at`, `weight_grams`). Lifecycle (`status`, `is_visible`, `is_sellable`, `allow_overselling`). SEO (`meta_*`), structured attrs (`tags`, `certifications`, `specifications` jsonb).
- **`product_stats`** (1:1 with products) — `views`, `cart_adds/removes`, `purchases`, `units_sold`, `revenue`, `last_viewed_at`, `last_purchased_at`. Auto-created by `init_product_stats` trigger.
- **`price_history`** — append-only audit. `old_price/new_price`, `old_cost/new_cost`, `change_reason`, `source` (`manual`|`system` from `auth.role()`), `changed_by` (`auth.uid()`).
- **`stock_history`** — append-only audit, mirrors price_history. `old_stock/new_stock`, `old_reserved/new_reserved`, `delta_stock` (generated), `change_reason`, `source`, `changed_by`.

## Triggers (all `SECURITY DEFINER`)

| trigger | fires on | purpose |
|---|---|---|
| `generate_product_handle` | BEFORE INSERT products | URL slug from `title_sv` |
| `guard_product_price_range` | BEFORE INS/UPD products | blocks price <0 or >100000, logs `security_events` |
| `init_product_stats` | AFTER INSERT products | creates matching `product_stats` row |
| `log_product_price_change` | AFTER UPDATE products | appends to `price_history` on price/cost change |
| `log_product_stock_change` | AFTER UPDATE products | appends to `stock_history` on stock/reserved change |

## RLS pattern (all 4 tables)

- SELECT: public
- INSERT/UPDATE/DELETE on `products`/`product_stats`: admins (`is_admin(auth.uid())`)
- `price_history` / `stock_history`: insert/delete admin-only, **no UPDATE policy** (audit log immutable)

## Logging contract

No silent writes. Every price/stock mutation flows through a trigger →
audit table. Pipeline-level decisions go to `change_log` via `logChange()` (TS).
Deterministic events go to `ecommerce_events` via `emit_ecommerce_event()` RPC.

## Why: replaces the user's request to recreate `products`/`product_stats`/`price_history`

User's spec was a strict subset of what already exists. Recreating would have wiped
live data. The existing schema is the canonical source of truth; `stock_history` was
added to round out the "everything logged" rule, mirroring `price_history` 1:1.
