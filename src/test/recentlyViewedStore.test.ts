import { describe, it, expect, beforeEach } from 'vitest';
import type { Product } from '@/lib/catalog';

import { useRecentlyViewedStore } from '@/stores/recentlyViewedStore';

function makeProduct(id: string): Product {
  return {
    node: {
      id,
      title: `Product ${id}`,
      description: '',
      handle: `product-${id}`,
      priceRange: {
        minVariantPrice: { amount: '100', currencyCode: 'SEK' },
      },
      images: { edges: [] },
      variants: { edges: [] },
      options: [],
    },
  } as unknown as Product;
}

describe('useRecentlyViewedStore', () => {
  beforeEach(() => {
    useRecentlyViewedStore.setState({ products: [] });
  });

  it('starts with an empty product list', () => {
    expect(useRecentlyViewedStore.getState().products).toHaveLength(0);
  });

  it('adds a product to the list', () => {
    const p = makeProduct('1');
    useRecentlyViewedStore.getState().addProduct(p);
    expect(useRecentlyViewedStore.getState().products).toHaveLength(1);
    expect(useRecentlyViewedStore.getState().products[0].node.id).toBe('1');
  });

  it('adds the new product at the beginning (most-recent-first order)', () => {
    useRecentlyViewedStore.getState().addProduct(makeProduct('1'));
    useRecentlyViewedStore.getState().addProduct(makeProduct('2'));
    const ids = useRecentlyViewedStore.getState().products.map((p) => p.node.id);
    expect(ids).toEqual(['2', '1']);
  });

  it('moves an already-viewed product to the front instead of duplicating it', () => {
    useRecentlyViewedStore.getState().addProduct(makeProduct('1'));
    useRecentlyViewedStore.getState().addProduct(makeProduct('2'));
    useRecentlyViewedStore.getState().addProduct(makeProduct('1'));
    const ids = useRecentlyViewedStore.getState().products.map((p) => p.node.id);
    expect(ids).toEqual(['1', '2']);
  });

  it('does not exceed the maximum of 8 products', () => {
    for (let i = 1; i <= 10; i++) {
      useRecentlyViewedStore.getState().addProduct(makeProduct(String(i)));
    }
    expect(useRecentlyViewedStore.getState().products).toHaveLength(8);
  });

  it('keeps the most-recently-added products when the limit is reached', () => {
    for (let i = 1; i <= 10; i++) {
      useRecentlyViewedStore.getState().addProduct(makeProduct(String(i)));
    }
    const ids = useRecentlyViewedStore.getState().products.map((p) => p.node.id);
    // Products 10 down to 3 should be present (10 most-recent)
    expect(ids[0]).toBe('10');
    expect(ids[7]).toBe('3');
  });

  it('clearProducts empties the list', () => {
    useRecentlyViewedStore.getState().addProduct(makeProduct('1'));
    useRecentlyViewedStore.getState().clearProducts();
    expect(useRecentlyViewedStore.getState().products).toHaveLength(0);
  });
});
