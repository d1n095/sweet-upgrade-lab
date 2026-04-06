
-- affiliate_orders
ALTER TABLE public.affiliate_orders RENAME COLUMN shopify_order_id TO external_order_id;

-- bundle_items
ALTER TABLE public.bundle_items RENAME COLUMN shopify_product_id TO product_id;
ALTER TABLE public.bundle_items RENAME COLUMN shopify_variant_id TO variant_id;

-- bundle_products
ALTER TABLE public.bundle_products RENAME COLUMN shopify_product_id TO product_id;
ALTER TABLE public.bundle_products RENAME COLUMN shopify_variant_id TO variant_id;

-- influencer_products
ALTER TABLE public.influencer_products RENAME COLUMN shopify_product_id TO product_id;
ALTER TABLE public.influencer_products RENAME COLUMN shopify_variant_id TO variant_id;

-- member_prices
ALTER TABLE public.member_prices RENAME COLUMN shopify_product_id TO product_id;
ALTER TABLE public.member_prices RENAME COLUMN shopify_variant_id TO variant_id;

-- orders
ALTER TABLE public.orders RENAME COLUMN shopify_order_id TO external_order_id;
ALTER TABLE public.orders RENAME COLUMN shopify_order_number TO external_order_number;

-- product_sales
ALTER TABLE public.product_sales RENAME COLUMN shopify_product_id TO product_id;

-- product_translations
ALTER TABLE public.product_translations RENAME COLUMN shopify_product_id TO product_id;

-- reviews
ALTER TABLE public.reviews RENAME COLUMN shopify_product_id TO product_id;
ALTER TABLE public.reviews RENAME COLUMN shopify_product_handle TO product_handle;

-- volume_discounts
ALTER TABLE public.volume_discounts RENAME COLUMN shopify_product_id TO product_id;

-- wishlists
ALTER TABLE public.wishlists RENAME COLUMN shopify_product_id TO product_id;
ALTER TABLE public.wishlists RENAME COLUMN shopify_product_handle TO product_handle;
