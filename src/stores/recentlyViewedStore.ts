import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface RecentlyViewedItem {
  id: string;
  handle: string;
  title: string;
  price: number;
  imageUrl: string | null;
}

interface RecentlyViewedStore {
  products: RecentlyViewedItem[];
  addProduct: (item: RecentlyViewedItem) => void;
  clearProducts: () => void;
}

const MAX_PRODUCTS = 8;

export const useRecentlyViewedStore = create<RecentlyViewedStore>()(
  persist(
    (set, get) => ({
      products: [],

      addProduct: (item) => {
        const { products } = get();
        const filtered = products.filter(p => p.id !== item.id);
        set({ products: [item, ...filtered].slice(0, MAX_PRODUCTS) });
      },

      clearProducts: () => set({ products: [] }),
    }),
    {
      name: 'recently-viewed',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      migrate: (_state, version) => {
        // Clear any pre-v1 state
        if (version < 1) return { products: [] };
        return _state as RecentlyViewedStore;
      },
      partialize: (state) => ({ products: state.products }),
    }
  )
);
