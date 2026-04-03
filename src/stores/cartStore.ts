import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * Product shape used inside CartItem.
 * The nested `node.*` structure is intentional — it matches what DbProductCard constructs
 * when adding items to the cart, and what ShopifyCartDrawer reads when rendering cart items
 * (e.g. `item.product.node.title`, `item.product.node.images.edges[0].node.url`).
 * Changing this shape would break localStorage cart deserialization for existing users.
 */
export interface CartProduct {
  dbId: string;
  node: {
    id: string;
    title: string;
    handle: string;
    description: string;
    productType: string;
    tags: string[];
    priceRange: { minVariantPrice: { amount: string; currencyCode: string } };
    images: { edges: Array<{ node: { url: string; altText: string | null } }> };
    variants: {
      edges: Array<{
        node: {
          id: string;
          title: string;
          price: { amount: string; currencyCode: string };
          availableForSale: boolean;
          quantityAvailable?: number | null;
          selectedOptions: Array<{ name: string; value: string }>;
        };
      }>;
    };
    options?: Array<{ name: string; values: string[] }>;
  };
}

export interface CartItem {
  product: CartProduct;
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

/**
 * Builds a synthetic variant ID for DB products that have no real variants.
 * Used when constructing CartProduct from a DB product ID.
 */
export const dbVariantId = (productId: string) => `${productId}-variant`;

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
  setLoading: (loading: boolean) => void;
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
      isLoading: false,
      isHydrated: false,
      _hasHydrated: false,
      lastUpdatedAt: 0,
      setHasHydrated: (v: boolean) => set({ isHydrated: v, _hasHydrated: v }),

      addItem: (item) => {
        const productId = (item.product as any)?.dbId || item.variantId;

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
          void productId; // reserved for future logging
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
          void productId;
        }

        set((state) => ({
          items: state.items.filter((item) => item.variantId !== variantId),
          lastUpdatedAt: getTimestamp(),
        }));
      },

      clearCart: () => {
        set({
          items: [],
          lastUpdatedAt: getTimestamp(),
        });
      },

      setLoading: (isLoading) => set({ isLoading }),

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
        lastUpdatedAt: state.lastUpdatedAt,
      }),
    }
  )
);
