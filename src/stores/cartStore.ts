import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { ShopifyProduct, createStorefrontCheckout } from '@/lib/shopify';
import { trackAddToCart, trackRemoveFromCart, trackCartUpdate } from '@/utils/analyticsTracker';

export interface CartItem {
  product: ShopifyProduct;
  variantId: string;
  variantTitle: string;
  price: {
    amount: string;
    currencyCode: string;
  };
  quantity: number;
  selectedOptions: Array<{
    name: string;
    value: string;
  }>;
}

interface CartStore {
  items: CartItem[];
  cartId: string | null;
  checkoutUrl: string | null;
  isLoading: boolean;
  isHydrated: boolean;
  _hasHydrated: boolean;
  lastUpdatedAt: number;
  setHasHydrated: (v: boolean) => void;

  addItem: (item: CartItem) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  removeItem: (variantId: string) => void;
  clearCart: () => void;
  setCartId: (cartId: string) => void;
  setCheckoutUrl: (url: string) => void;
  setLoading: (loading: boolean) => void;
  createCheckout: () => Promise<void>;
  totalItems: () => number;
  totalPrice: () => number;
}

const sanitizeItems = (rawItems: CartItem[] = []): CartItem[] => {
  const deduped = new Map<string, CartItem>();

  for (const raw of rawItems) {
    if (!raw || typeof raw.variantId !== 'string' || raw.variantId.length === 0) continue;

    const quantity = Number.isFinite(raw.quantity) ? Math.max(1, Math.floor(raw.quantity)) : 1;
    const parsedAmount = Number.parseFloat(raw.price?.amount ?? '0');

    const normalized: CartItem = {
      ...raw,
      quantity,
      price: {
        amount: Number.isFinite(parsedAmount) ? parsedAmount.toString() : '0',
        currencyCode: raw.price?.currencyCode || 'SEK',
      },
      selectedOptions: Array.isArray(raw.selectedOptions) ? raw.selectedOptions : [],
    };

    const existing = deduped.get(raw.variantId);
    if (existing) {
      deduped.set(raw.variantId, {
        ...normalized,
        quantity: existing.quantity + normalized.quantity,
      });
    } else {
      deduped.set(raw.variantId, normalized);
    }
  }

  return Array.from(deduped.values());
};

const getTimestamp = () => Date.now();

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      cartId: null,
      checkoutUrl: null,
      isLoading: false,
      isHydrated: false,
      _hasHydrated: false,
      lastUpdatedAt: 0,
      setHasHydrated: (v: boolean) => set({ isHydrated: v, _hasHydrated: v }),

      addItem: (item) => {
        const productId = (item.product as any)?.dbId || item.variantId;
        trackAddToCart(productId, item.product.node.title, Number.parseFloat(item.price.amount), item.quantity);

        set((state) => {
          const items = sanitizeItems(state.items);
          const existing = items.find((i) => i.variantId === item.variantId);

          const nextItems = existing
            ? items.map((i) =>
                i.variantId === item.variantId
                  ? { ...i, quantity: i.quantity + Math.max(1, item.quantity) }
                  : i
              )
            : [...items, { ...item, quantity: Math.max(1, item.quantity) }];

          return {
            items: sanitizeItems(nextItems),
            lastUpdatedAt: getTimestamp(),
          };
        });
      },

      updateQuantity: (variantId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(variantId);
          return;
        }

        const existing = get().items.find((i) => i.variantId === variantId);
        if (existing) {
          const productId = (existing.product as any)?.dbId || variantId;
          trackCartUpdate(productId, existing.product.node.title, existing.quantity, quantity);
        }

        set((state) => ({
          items: state.items.map((item) =>
            item.variantId === variantId ? { ...item, quantity: Math.max(1, Math.floor(quantity)) } : item
          ),
          lastUpdatedAt: getTimestamp(),
        }));
      },

      removeItem: (variantId) => {
        const existing = get().items.find((i) => i.variantId === variantId);
        if (existing) {
          const productId = (existing.product as any)?.dbId || variantId;
          trackRemoveFromCart(
            productId,
            existing.product.node.title,
            Number.parseFloat(existing.price.amount),
            existing.quantity
          );
        }

        set((state) => ({
          items: state.items.filter((item) => item.variantId !== variantId),
          lastUpdatedAt: getTimestamp(),
        }));
      },

      clearCart: () => {
        set({
          items: [],
          cartId: null,
          checkoutUrl: null,
          lastUpdatedAt: getTimestamp(),
        });
      },

      setCartId: (cartId) => set({ cartId, lastUpdatedAt: getTimestamp() }),
      setCheckoutUrl: (checkoutUrl) => set({ checkoutUrl, lastUpdatedAt: getTimestamp() }),
      setLoading: (isLoading) => set({ isLoading }),

      createCheckout: async () => {
        const { items, setLoading, setCheckoutUrl } = get();
        if (items.length === 0) return;

        setLoading(true);
        try {
          const checkoutUrl = await createStorefrontCheckout(
            items.map((item) => ({ variantId: item.variantId, quantity: item.quantity }))
          );
          setCheckoutUrl(checkoutUrl);
        } catch (error) {
          console.error('Failed to create checkout:', error);
        } finally {
          setLoading(false);
        }
      },

      totalItems: () => get().items.reduce((sum, item) => sum + item.quantity, 0),
      totalPrice: () => get().items.reduce((sum, item) => sum + Number.parseFloat(item.price.amount) * item.quantity, 0),
    }),
    {
      name: 'shopify-cart',
      version: 2,
      storage: createJSONStorage(() => localStorage),
      merge: (persistedState, currentState) => {
        const persisted = (persistedState as Partial<CartStore>) || {};
        const current = currentState as CartStore;

        const persistedUpdatedAt = typeof persisted.lastUpdatedAt === 'number' ? persisted.lastUpdatedAt : 0;
        const currentUpdatedAt = typeof current.lastUpdatedAt === 'number' ? current.lastUpdatedAt : 0;
        const usePersisted = persistedUpdatedAt >= currentUpdatedAt;

        return {
          ...current,
          items: usePersisted
            ? sanitizeItems(persisted.items || [])
            : sanitizeItems(current.items || []),
          cartId: usePersisted ? persisted.cartId ?? null : current.cartId,
          checkoutUrl: usePersisted ? persisted.checkoutUrl ?? null : current.checkoutUrl,
          lastUpdatedAt: Math.max(persistedUpdatedAt, currentUpdatedAt),
          isHydrated: false,
          _hasHydrated: false,
        };
      },
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error('Cart rehydration failed:', error);
        }

        useCartStore.setState({
          items: sanitizeItems(state?.items || []),
          isHydrated: true,
          _hasHydrated: true,
        });
      },
      partialize: (state) => ({
        items: state.items,
        cartId: state.cartId,
        checkoutUrl: state.checkoutUrl,
        lastUpdatedAt: state.lastUpdatedAt,
      }),
    }
  )
);
