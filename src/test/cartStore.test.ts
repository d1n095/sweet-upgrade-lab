import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { CartItem } from '@/stores/cartStore';

// ── Mocks ──────────────────────────────────────────────────────────────────
vi.mock('@/lib/catalog', () => ({}));

// ── Helpers ────────────────────────────────────────────────────────────────
import { useCartStore } from '@/stores/cartStore';

function makeItem(variantId: string, quantity = 1, amount = '100'): CartItem {
  return {
    product: {
      node: {
        id: variantId,
        title: `Product ${variantId}`,
        description: '',
        handle: `product-${variantId}`,
        priceRange: { minVariantPrice: { amount, currencyCode: 'SEK' } },
        images: { edges: [] },
        variants: { edges: [] },
        options: [],
      },
    } as any,
    variantId,
    variantTitle: 'Default Title',
    price: { amount, currencyCode: 'SEK' },
    quantity,
    selectedOptions: [],
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────
describe('useCartStore', () => {
  beforeEach(() => {
    useCartStore.setState({
      items: [],
      cartId: null,
      checkoutUrl: null,
      isLoading: false,
      isHydrated: false,
      _hasHydrated: false,
      lastUpdatedAt: 0,
    });
  });

  // ── Initial state ────────────────────────────────────────────────────────
  describe('initial state', () => {
    it('starts with an empty cart', () => {
      expect(useCartStore.getState().items).toHaveLength(0);
    });

    it('totalItems returns 0 on an empty cart', () => {
      expect(useCartStore.getState().totalItems()).toBe(0);
    });

    it('totalPrice returns 0 on an empty cart', () => {
      expect(useCartStore.getState().totalPrice()).toBe(0);
    });
  });

  // ── addItem ──────────────────────────────────────────────────────────────
  describe('addItem', () => {
    it('adds a new item to the cart', () => {
      useCartStore.getState().addItem(makeItem('var1'));
      expect(useCartStore.getState().items).toHaveLength(1);
    });

    it('increments quantity when the same variant is added again', () => {
      useCartStore.getState().addItem(makeItem('var1', 2));
      useCartStore.getState().addItem(makeItem('var1', 3));
      const item = useCartStore.getState().items[0];
      expect(item.quantity).toBe(5);
    });

    it('treats different variantIds as different items', () => {
      useCartStore.getState().addItem(makeItem('var1'));
      useCartStore.getState().addItem(makeItem('var2'));
      expect(useCartStore.getState().items).toHaveLength(2);
    });

    it('clamps quantity to at least 1', () => {
      useCartStore.getState().addItem(makeItem('var1', -5));
      expect(useCartStore.getState().items[0].quantity).toBe(1);
    });

    it('floors a fractional quantity', () => {
      useCartStore.getState().addItem(makeItem('var1', 2.9));
      expect(useCartStore.getState().items[0].quantity).toBe(2);
    });
  });

  // ── updateQuantity ───────────────────────────────────────────────────────
  describe('updateQuantity', () => {
    it('updates the quantity of an existing item', () => {
      useCartStore.getState().addItem(makeItem('var1', 1));
      useCartStore.getState().updateQuantity('var1', 5);
      expect(useCartStore.getState().items[0].quantity).toBe(5);
    });

    it('removes the item when quantity is set to 0', () => {
      useCartStore.getState().addItem(makeItem('var1', 2));
      useCartStore.getState().updateQuantity('var1', 0);
      expect(useCartStore.getState().items).toHaveLength(0);
    });

    it('removes the item when quantity is negative', () => {
      useCartStore.getState().addItem(makeItem('var1', 2));
      useCartStore.getState().updateQuantity('var1', -1);
      expect(useCartStore.getState().items).toHaveLength(0);
    });

    it('does nothing for an unknown variantId', () => {
      useCartStore.getState().addItem(makeItem('var1', 1));
      useCartStore.getState().updateQuantity('unknown', 10);
      expect(useCartStore.getState().items[0].quantity).toBe(1);
    });

    it('floors a fractional quantity value', () => {
      useCartStore.getState().addItem(makeItem('var1', 1));
      useCartStore.getState().updateQuantity('var1', 3.7);
      expect(useCartStore.getState().items[0].quantity).toBe(3);
    });
  });

  // ── removeItem ───────────────────────────────────────────────────────────
  describe('removeItem', () => {
    it('removes the item with the given variantId', () => {
      useCartStore.getState().addItem(makeItem('var1'));
      useCartStore.getState().addItem(makeItem('var2'));
      useCartStore.getState().removeItem('var1');
      const ids = useCartStore.getState().items.map((i) => i.variantId);
      expect(ids).toEqual(['var2']);
    });

    it('does nothing for an unknown variantId', () => {
      useCartStore.getState().addItem(makeItem('var1'));
      useCartStore.getState().removeItem('unknown');
      expect(useCartStore.getState().items).toHaveLength(1);
    });
  });

  // ── clearCart ────────────────────────────────────────────────────────────
  describe('clearCart', () => {
    it('removes all items', () => {
      useCartStore.getState().addItem(makeItem('var1'));
      useCartStore.getState().addItem(makeItem('var2'));
      useCartStore.getState().clearCart();
      expect(useCartStore.getState().items).toHaveLength(0);
    });

    it('resets cartId to null', () => {
      useCartStore.getState().setCartId('cart-abc');
      useCartStore.getState().clearCart();
      expect(useCartStore.getState().cartId).toBeNull();
    });

    it('resets checkoutUrl to null', () => {
      useCartStore.getState().setCheckoutUrl('https://example.com');
      useCartStore.getState().clearCart();
      expect(useCartStore.getState().checkoutUrl).toBeNull();
    });
  });

  // ── totalItems / totalPrice ──────────────────────────────────────────────
  describe('totals', () => {
    it('totalItems sums all quantities', () => {
      useCartStore.getState().addItem(makeItem('var1', 2));
      useCartStore.getState().addItem(makeItem('var2', 3));
      expect(useCartStore.getState().totalItems()).toBe(5);
    });

    it('totalPrice multiplies price × quantity for each item and sums', () => {
      useCartStore.getState().addItem(makeItem('var1', 2, '50'));
      useCartStore.getState().addItem(makeItem('var2', 1, '100'));
      expect(useCartStore.getState().totalPrice()).toBe(200);
    });

    it('totalPrice handles items with non-numeric price gracefully', () => {
      useCartStore.getState().addItem(makeItem('var1', 1, 'NaN'));
      // sanitizeItems normalises NaN amounts to '0'
      expect(useCartStore.getState().totalPrice()).toBe(0);
    });
  });

  // ── setCartId / setCheckoutUrl / setLoading ──────────────────────────────
  describe('setters', () => {
    it('setCartId stores the cart ID', () => {
      useCartStore.getState().setCartId('cart-xyz');
      expect(useCartStore.getState().cartId).toBe('cart-xyz');
    });

    it('setCheckoutUrl stores the checkout URL', () => {
      useCartStore.getState().setCheckoutUrl('https://checkout.example.com');
      expect(useCartStore.getState().checkoutUrl).toBe('https://checkout.example.com');
    });

    it('setLoading updates the loading flag', () => {
      useCartStore.getState().setLoading(true);
      expect(useCartStore.getState().isLoading).toBe(true);
      useCartStore.getState().setLoading(false);
      expect(useCartStore.getState().isLoading).toBe(false);
    });
  });

  // ── sanitize / dedup on addItem ──────────────────────────────────────────
  describe('sanitization on state mutations', () => {
    it('deduplicates items with the same variantId by accumulating quantity', () => {
      // Manually inject duplicates and then add another item to trigger sanitize
      useCartStore.setState({
        items: [makeItem('var1', 2), makeItem('var1', 3)],
      });
      useCartStore.getState().addItem(makeItem('var1', 1));
      // After sanitize inside addItem: 2+3 = 5, then +1 = 6
      expect(useCartStore.getState().items).toHaveLength(1);
      expect(useCartStore.getState().items[0].quantity).toBe(6);
    });

    it('filters out items without a valid variantId', () => {
      useCartStore.setState({
        items: [makeItem('', 1), makeItem('var1', 1)],
      });
      useCartStore.getState().addItem(makeItem('var2', 1));
      const ids = useCartStore.getState().items.map((i) => i.variantId);
      expect(ids).not.toContain('');
    });

    it('normalises a missing price amount to "0"', () => {
      const item = makeItem('var1', 1);
      (item.price as any).amount = undefined;
      useCartStore.getState().addItem(item);
      expect(useCartStore.getState().items[0].price.amount).toBe('0');
    });

    it('defaults currencyCode to SEK when missing', () => {
      const item = makeItem('var1', 1);
      (item.price as any).currencyCode = undefined;
      useCartStore.getState().addItem(item);
      expect(useCartStore.getState().items[0].price.currencyCode).toBe('SEK');
    });

    it('defaults selectedOptions to an empty array when not an array', () => {
      const item = makeItem('var1', 1);
      (item as any).selectedOptions = null;
      useCartStore.getState().addItem(item);
      expect(useCartStore.getState().items[0].selectedOptions).toEqual([]);
    });
  });
});
