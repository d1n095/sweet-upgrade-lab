import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { logSettingsChange } from '@/utils/activityLogger';

interface StoreSettingsState {
  siteActive: boolean;
  checkoutEnabled: boolean;
  registrationEnabled: boolean;
  homepageBestsellers: boolean;
  homepageReviews: boolean;
  homepagePhilosophy: boolean;
  homepageAbout: boolean;
  isLoaded: boolean;
  fetchSettings: () => Promise<void>;
  setSiteActive: (enabled: boolean) => Promise<void>;
  setCheckoutEnabled: (enabled: boolean) => Promise<void>;
  setRegistrationEnabled: (enabled: boolean) => Promise<void>;
  setHomepageSetting: (key: string, enabled: boolean) => Promise<void>;
}

const HOMEPAGE_KEYS = ['homepage_bestsellers', 'homepage_reviews', 'homepage_philosophy', 'homepage_about'];

export const useStoreSettings = create<StoreSettingsState>((set, get) => ({
  siteActive: true,
  checkoutEnabled: true,
  registrationEnabled: true,
  homepageBestsellers: false,
  homepageReviews: false,
  homepagePhilosophy: true,
  homepageAbout: true,
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
        homepageBestsellers: map['homepage_bestsellers'] ?? false,
        homepageReviews: map['homepage_reviews'] ?? false,
        homepagePhilosophy: map['homepage_philosophy'] ?? true,
        homepageAbout: map['homepage_about'] ?? true,
        isLoaded: true,
      });
    } else {
      set({ isLoaded: true });
    }
  },

  setSiteActive: async (enabled) => {
    const old = get().siteActive;
    set({ siteActive: enabled });
    await supabase
      .from('store_settings')
      .upsert({ key: 'site_active', value: enabled, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    logSettingsChange('site_active', old, enabled);
  },

  setCheckoutEnabled: async (enabled) => {
    const old = get().checkoutEnabled;
    set({ checkoutEnabled: enabled });
    await supabase
      .from('store_settings')
      .upsert({ key: 'checkout_enabled', value: enabled, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    logSettingsChange('checkout_enabled', old, enabled);
  },

  setHomepageSetting: async (key, enabled) => {
    const stateKey = key.replace('homepage_', 'homepage') as string;
    const camelKey = key === 'homepage_bestsellers' ? 'homepageBestsellers'
      : key === 'homepage_reviews' ? 'homepageReviews'
      : key === 'homepage_philosophy' ? 'homepagePhilosophy'
      : key === 'homepage_about' ? 'homepageAbout'
      : null;
    if (camelKey) {
      set({ [camelKey]: enabled } as any);
    }
    await supabase
      .from('store_settings')
      .upsert({ key, value: enabled, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  },
}));

// Realtime subscription for instant sync across tabs/users
supabase
  .channel('store-settings-realtime')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'store_settings' }, (payload) => {
    const { key, value } = payload.new as { key: string; value: boolean };
    if (key === 'site_active') useStoreSettings.setState({ siteActive: value });
    if (key === 'checkout_enabled') useStoreSettings.setState({ checkoutEnabled: value });
    if (key === 'homepage_bestsellers') useStoreSettings.setState({ homepageBestsellers: value });
    if (key === 'homepage_reviews') useStoreSettings.setState({ homepageReviews: value });
    if (key === 'homepage_philosophy') useStoreSettings.setState({ homepagePhilosophy: value });
    if (key === 'homepage_about') useStoreSettings.setState({ homepageAbout: value });
  })
  .subscribe();
