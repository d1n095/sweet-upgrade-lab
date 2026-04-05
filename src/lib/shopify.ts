/**
 * Shopify compatibility layer.
 *
 * All product data is served from the local database via `catalog.ts`.
 * `ShopifyProduct` is an alias for the generic `Product` type.
 * `createStorefrontCheckout` delegates to the `create-checkout` edge function.
 */
export type { Product as ShopifyProduct } from '@/lib/catalog';
export { fetchProducts } from '@/lib/catalog';

import { safeInvoke } from '@/lib/safeInvoke';

interface LineItem {
  variantId: string;
  quantity: number;
}

/**
 * Create a checkout session for the given line items.
 * Returns the checkout / redirect URL on success.
 */
export async function createStorefrontCheckout(items: LineItem[]): Promise<string> {
  const { data, error } = await safeInvoke<{ url?: string; sessionUrl?: string }>('create-checkout', {
    body: { items },
  });

  if (error) throw error;

  const url = data?.sessionUrl || data?.url;
  if (!url) throw new Error('No checkout URL returned from create-checkout');

  return url;
}
