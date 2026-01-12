import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { ShopifyProduct } from '@/lib/shopify';
import { supabase } from '@/integrations/supabase/client';

interface WishlistStore {
  items: ShopifyProduct[];
  isLoading: boolean;
  userId: string | null;
  
  // Actions
  addItem: (product: ShopifyProduct) => Promise<void>;
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
      
      addItem: async (product) => {
        const { items, userId } = get();
        const exists = items.some(item => item.node.id === product.node.id);
        if (exists) return;

        // Update local state immediately
        set({ items: [...items, product] });

        // If logged in, sync to database
        if (userId) {
          try {
            await supabase.from('wishlists').insert({
              user_id: userId,
              shopify_product_id: product.node.id,
              shopify_product_handle: product.node.handle
            });
          } catch (error) {
            console.error('Failed to sync wishlist item to database:', error);
          }
        }
      },
      
      removeItem: async (productId) => {
        const { items, userId } = get();
        
        // Update local state immediately
        set({ items: items.filter(item => item.node.id !== productId) });

        // If logged in, remove from database
        if (userId) {
          try {
            await supabase
              .from('wishlists')
              .delete()
              .eq('user_id', userId)
              .eq('shopify_product_id', productId);
          } catch (error) {
            console.error('Failed to remove wishlist item from database:', error);
          }
        }
      },
      
      isInWishlist: (productId) => {
        return get().items.some(item => item.node.id === productId);
      },
      
      clearWishlist: async () => {
        const { userId } = get();
        
        set({ items: [] });

        // If logged in, clear from database
        if (userId) {
          try {
            await supabase
              .from('wishlists')
              .delete()
              .eq('user_id', userId);
          } catch (error) {
            console.error('Failed to clear wishlist from database:', error);
          }
        }
      },

      clearLocalWishlist: () => {
        set({ items: [], userId: null });
      },

      syncWithDatabase: async (userId) => {
        set({ isLoading: true, userId });

        try {
          // Fetch wishlist from database
          const { data: dbWishlist, error } = await supabase
            .from('wishlists')
            .select('*')
            .eq('user_id', userId);

          if (error) throw error;

          const { items: localItems } = get();
          
          // If user has local items that aren't in DB, add them
          const dbProductIds = new Set(dbWishlist?.map(w => w.shopify_product_id) || []);
          const localItemsToSync = localItems.filter(
            item => !dbProductIds.has(item.node.id)
          );

          // Sync local items to database (upsert style - ignore conflicts)
          for (const item of localItemsToSync) {
            const { error: insertError } = await supabase.from('wishlists').upsert({
              user_id: userId,
              shopify_product_id: item.node.id,
              shopify_product_handle: item.node.handle
            }, { onConflict: 'user_id,shopify_product_id' });
            
            if (insertError) {
              console.error('Failed to sync item:', insertError);
            }
          }

          // Note: We keep local items as they contain the full product data
          // The database just tracks which products are in the wishlist

        } catch (error) {
          console.error('Failed to sync wishlist with database:', error);
        } finally {
          set({ isLoading: false });
        }
      },
    }),
    {
      name: 'wishlist-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ 
        items: state.items,
        // Don't persist userId - we'll get it from auth state
      }),
    }
  )
);
