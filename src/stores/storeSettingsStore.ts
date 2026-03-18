import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';

interface StoreSettingsState {
  siteActive: boolean;
  checkoutEnabled: boolean;
  isLoaded: boolean;
  fetchSettings: () => Promise<void>;
  setSiteActive: (enabled: boolean) => Promise<void>;
  setCheckoutEnabled: (enabled: boolean) => Promise<void>;
}

export const useStoreSettings = create<StoreSettingsState>((set, get) => ({
  siteActive: true,
  checkoutEnabled: true,
  isLoaded: false,

  fetchSettings: async () => {
    const { data } = await supabase
      .from('store_settings')
      .select('key, value');

    if (data) {
      const map = Object.fromEntries(data.map(r => [r.key, r.value]));
      set({
        siteActive: map['site_active'] ?? true,
        checkoutEnabled: map['checkout_enabled'] ?? true,
        isLoaded: true,
      });
    } else {
      set({ isLoaded: true });
    }
  },

  setSiteActive: async (enabled) => {
    set({ siteActive: enabled });
    await supabase
      .from('store_settings')
      .update({ value: enabled, updated_at: new Date().toISOString() })
      .eq('key', 'site_active');
  },

  setCheckoutEnabled: async (enabled) => {
    set({ checkoutEnabled: enabled });
    await supabase
      .from('store_settings')
      .update({ value: enabled, updated_at: new Date().toISOString() })
      .eq('key', 'checkout_enabled');
  },
}));

// Realtime subscription for instant sync across tabs/users
supabase
  .channel('store-settings-realtime')
  .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'store_settings' }, (payload) => {
    const { key, value } = payload.new as { key: string; value: boolean };
    if (key === 'site_active') useStoreSettings.setState({ siteActive: value });
    if (key === 'checkout_enabled') useStoreSettings.setState({ checkoutEnabled: value });
  })
  .subscribe();
