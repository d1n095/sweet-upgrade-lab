import { describe, it, expect, beforeEach } from 'vitest';
import { useRecentlyViewedStore, RecentlyViewedItem } from '@/stores/recentlyViewedStore';

function makeItem(id: string): RecentlyViewedItem {
  return {
    id,
    handle: `product-${id}`,
    title: `Product ${id}`,
    price: 100,
    imageUrl: null,
  };
}

describe('useRecentlyViewedStore', () => {
  beforeEach(() => {
    useRecentlyViewedStore.setState({ products: [] });
  });

  it('starts with an empty product list', () => {
    expect(useRecentlyViewedStore.getState().products).toHaveLength(0);
  });

  it('adds a product to the list', () => {
    useRecentlyViewedStore.getState().addProduct(makeItem('1'));
    expect(useRecentlyViewedStore.getState().products).toHaveLength(1);
    expect(useRecentlyViewedStore.getState().products[0].id).toBe('1');
  });

  it('adds the new product at the beginning (most-recent-first order)', () => {
    useRecentlyViewedStore.getState().addProduct(makeItem('1'));
    useRecentlyViewedStore.getState().addProduct(makeItem('2'));
    const ids = useRecentlyViewedStore.getState().products.map((p) => p.id);
    expect(ids).toEqual(['2', '1']);
  });

  it('moves an already-viewed product to the front instead of duplicating it', () => {
    useRecentlyViewedStore.getState().addProduct(makeItem('1'));
    useRecentlyViewedStore.getState().addProduct(makeItem('2'));
    useRecentlyViewedStore.getState().addProduct(makeItem('1'));
    const ids = useRecentlyViewedStore.getState().products.map((p) => p.id);
    expect(ids).toEqual(['1', '2']);
  });

  it('does not exceed the maximum of 8 products', () => {
    for (let i = 1; i <= 10; i++) {
      useRecentlyViewedStore.getState().addProduct(makeItem(String(i)));
    }
    expect(useRecentlyViewedStore.getState().products).toHaveLength(8);
  });

  it('keeps the most-recently-added products when the limit is reached', () => {
    for (let i = 1; i <= 10; i++) {
      useRecentlyViewedStore.getState().addProduct(makeItem(String(i)));
    }
    const ids = useRecentlyViewedStore.getState().products.map((p) => p.id);
    expect(ids[0]).toBe('10');
    expect(ids[7]).toBe('3');
  });

  it('clearProducts empties the list', () => {
    useRecentlyViewedStore.getState().addProduct(makeItem('1'));
    useRecentlyViewedStore.getState().clearProducts();
    expect(useRecentlyViewedStore.getState().products).toHaveLength(0);
  });
});
