import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { supabase } from '@/integrations/supabase/client';

export interface WishlistItem {
  id: string;
  handle: string;
  title: string;
  price: number;
  imageUrl: string | null;
}

interface WishlistStore {
  items: WishlistItem[];
  isLoading: boolean;
  userId: string | null;

  addItem: (item: WishlistItem) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
  isInWishlist: (productId: string) => boolean;
  clearWishlist: () => Promise<void>;
  syncWithDatabase: (userId: string) => Promise<void>;
  clearLocalWishlist: () => void;
  setUserId: (userId: string | null) => void;
}

export const useWishlistStore = create<WishlistStore>()(
  persist(
    (set, get) => ({
      items: [],
      isLoading: false,
      userId: null,

      setUserId: (userId) => set({ userId }),

      addItem: async (item) => {
        const { items, userId } = get();
        const exists = items.some(i => i.id === item.id);
        if (exists) return;

        set({ items: [...items, item] });

        if (userId) {
          try {
            await supabase.from('wishlists').insert({
              user_id: userId,
              product_id: item.id,
              product_handle: item.handle,
            } as any);
          } catch (_) {}
        }
      },

      removeItem: async (productId) => {
        const { items, userId } = get();

        set({ items: items.filter(i => i.id !== productId) });

        if (userId) {
          try {
            await (supabase
              .from('wishlists') as any)
              .delete()
              .eq('user_id', userId)
              .eq('product_id', productId);
          } catch (_) {}
        }
      },

      isInWishlist: (productId) => get().items.some(i => i.id === productId),

      clearWishlist: async () => {
        const { userId } = get();
        set({ items: [] });

        if (userId) {
          try {
            await supabase.from('wishlists').delete().eq('user_id', userId);
          } catch (_) {}
        }
      },

      clearLocalWishlist: () => set({ items: [], userId: null }),

      syncWithDatabase: async (userId) => {
        set({ isLoading: true, userId });
        try {
          const { data: dbWishlist, error } = await (supabase
            .from('wishlists') as any)
            .select('product_id, product_handle')
            .eq('user_id', userId);

          if (error) throw error;

          const { items: localItems } = get();
          const dbIds = new Set((dbWishlist || []).map((w: any) => w.product_id));

          // Sync local items not yet in DB
          for (const item of localItems) {
            if (!dbIds.has(item.id)) {
              const { error: insertError } = await supabase.from('wishlists').upsert({
                user_id: userId,
                product_id: item.id,
                product_handle: item.handle,
              } as any, { onConflict: 'user_id,product_id' } as any);
              if (insertError) {}
            }
          }
        } catch (_) {
        } finally {
          set({ isLoading: false });
        }
      },
    }),
    {
      name: 'wishlist-storage',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      migrate: (_state, version) => {
        // Clear any pre-v1 state (was ShopifyProduct[])
        if (version < 1) return { items: [], isLoading: false, userId: null };
        return _state as WishlistStore;
      },
      partialize: (state) => ({ items: state.items }),
    }
  )
);
