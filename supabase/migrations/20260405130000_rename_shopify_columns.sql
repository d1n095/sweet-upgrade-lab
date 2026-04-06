-- Rename shopify_product_id, shopify_variant_id, shopify_product_handle, shopify_order_number columns

ALTER TABLE bundle_items
  RENAME COLUMN shopify_product_id TO product_id;
ALTER TABLE bundle_items
  RENAME COLUMN shopify_variant_id TO variant_id;

ALTER TABLE bundle_products
  RENAME COLUMN shopify_product_id TO product_id;
ALTER TABLE bundle_products
  RENAME COLUMN shopify_variant_id TO variant_id;

ALTER TABLE influencer_products
  RENAME COLUMN shopify_product_id TO product_id;
ALTER TABLE influencer_products
  RENAME COLUMN shopify_variant_id TO variant_id;

ALTER TABLE member_prices
  RENAME COLUMN shopify_product_id TO product_id;
ALTER TABLE member_prices
  RENAME COLUMN shopify_variant_id TO variant_id;

ALTER TABLE product_sales
  RENAME COLUMN shopify_product_id TO product_id;

ALTER TABLE product_translations
  RENAME COLUMN shopify_product_id TO product_id;

ALTER TABLE reviews
  RENAME COLUMN shopify_product_id TO product_id;
ALTER TABLE reviews
  RENAME COLUMN shopify_product_handle TO product_handle;

ALTER TABLE volume_discounts
  RENAME COLUMN shopify_product_id TO product_id;

ALTER TABLE wishlists
  RENAME COLUMN shopify_product_id TO product_id;
ALTER TABLE wishlists
  RENAME COLUMN shopify_product_handle TO product_handle;

ALTER TABLE orders
  RENAME COLUMN shopify_order_number TO external_order_number;
