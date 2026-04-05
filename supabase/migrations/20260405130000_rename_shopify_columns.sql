-- Rename Shopify-prefixed columns to generic names across all tables
-- Removes Shopify-branded column names; the platform no longer depends on Shopify.

DO $$ BEGIN

  -- ── member_prices ──────────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='member_prices' AND column_name='shopify_product_id') THEN
    ALTER TABLE public.member_prices RENAME COLUMN shopify_product_id TO product_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='member_prices' AND column_name='shopify_variant_id') THEN
    ALTER TABLE public.member_prices RENAME COLUMN shopify_variant_id TO variant_id;
  END IF;

  -- ── volume_discounts ───────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='volume_discounts' AND column_name='shopify_product_id') THEN
    ALTER TABLE public.volume_discounts RENAME COLUMN shopify_product_id TO product_id;
  END IF;

  -- ── bundle_products ────────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bundle_products' AND column_name='shopify_product_id') THEN
    ALTER TABLE public.bundle_products RENAME COLUMN shopify_product_id TO product_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bundle_products' AND column_name='shopify_variant_id') THEN
    ALTER TABLE public.bundle_products RENAME COLUMN shopify_variant_id TO variant_id;
  END IF;

  -- ── bundle_items ───────────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bundle_items' AND column_name='shopify_product_id') THEN
    ALTER TABLE public.bundle_items RENAME COLUMN shopify_product_id TO product_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bundle_items' AND column_name='shopify_variant_id') THEN
    ALTER TABLE public.bundle_items RENAME COLUMN shopify_variant_id TO variant_id;
  END IF;

  -- ── reviews ────────────────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='reviews' AND column_name='shopify_product_id') THEN
    ALTER TABLE public.reviews RENAME COLUMN shopify_product_id TO product_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='reviews' AND column_name='shopify_product_handle') THEN
    ALTER TABLE public.reviews RENAME COLUMN shopify_product_handle TO product_handle;
  END IF;

  -- ── orders ─────────────────────────────────────────────────────
  -- orders already has a generic order_number; rename the Shopify-specific one
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='shopify_order_number') THEN
    ALTER TABLE public.orders RENAME COLUMN shopify_order_number TO external_order_number;
  END IF;

  -- ── influencer_products ────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='influencer_products' AND column_name='shopify_product_id') THEN
    ALTER TABLE public.influencer_products RENAME COLUMN shopify_product_id TO product_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='influencer_products' AND column_name='shopify_variant_id') THEN
    ALTER TABLE public.influencer_products RENAME COLUMN shopify_variant_id TO variant_id;
  END IF;

  -- ── product_translations ───────────────────────────────────────
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='product_translations' AND column_name='shopify_product_id') THEN
    ALTER TABLE public.product_translations RENAME COLUMN shopify_product_id TO product_id;
  END IF;

  -- ── wishlists ──────────────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='wishlists' AND column_name='shopify_product_id') THEN
    ALTER TABLE public.wishlists RENAME COLUMN shopify_product_id TO product_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='wishlists' AND column_name='shopify_product_handle') THEN
    ALTER TABLE public.wishlists RENAME COLUMN shopify_product_handle TO product_handle;
  END IF;

  -- ── product_sales ──────────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='product_sales' AND column_name='shopify_product_id') THEN
    ALTER TABLE public.product_sales RENAME COLUMN shopify_product_id TO product_id;
  END IF;

END $$;
