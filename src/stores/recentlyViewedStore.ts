import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { ShopifyProduct } from '@/lib/shopify';

interface RecentlyViewedStore {
  products: ShopifyProduct[];
  addProduct: (product: ShopifyProduct) => void;
  clearProducts: () => void;
}

const MAX_PRODUCTS = 8;

export const useRecentlyViewedStore = create<RecentlyViewedStore>()(
  persist(
    (set, get) => ({
      products: [],

      addProduct: (product) => {
        const { products } = get();
        
        // Remove if already exists
        const filtered = products.filter(p => p.node.id !== product.node.id);
        
        // Add to beginning and limit to MAX_PRODUCTS
        const updated = [product, ...filtered].slice(0, MAX_PRODUCTS);
        
        set({ products: updated });
      },

      clearProducts: () => set({ products: [] }),
    }),
    {
      name: 'recently-viewed',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
