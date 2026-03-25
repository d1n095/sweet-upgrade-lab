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
  requirePhone: boolean;
  requireAddress: boolean;
  guestCheckout: boolean;
  autoSaveProfile: boolean;
  socialInstagram: string;
  socialFacebook: string;
  isLoaded: boolean;
  fetchSettings: () => Promise<void>;
  setSiteActive: (enabled: boolean) => Promise<void>;
  setCheckoutEnabled: (enabled: boolean) => Promise<void>;
  setRegistrationEnabled: (enabled: boolean) => Promise<void>;
  setHomepageSetting: (key: string, enabled: boolean) => Promise<void>;
  setProfileSetting: (key: string, enabled: boolean) => Promise<void>;
  setSocialSetting: (key: string, value: string) => Promise<void>;
}

const HOMEPAGE_KEYS = ['homepage_bestsellers', 'homepage_reviews', 'homepage_philosophy', 'homepage_about'];

const PROFILE_SETTING_MAP: Record<string, keyof StoreSettingsState> = {
  require_phone: 'requirePhone',
  require_address: 'requireAddress',
  guest_checkout: 'guestCheckout',
  auto_save_profile: 'autoSaveProfile',
};

export const useStoreSettings = create<StoreSettingsState>((set, get) => ({
  siteActive: true,
  checkoutEnabled: true,
  registrationEnabled: true,
  homepageBestsellers: false,
  homepageReviews: false,
  homepagePhilosophy: true,
  homepageAbout: true,
  requirePhone: false,
  requireAddress: false,
  guestCheckout: true,
  autoSaveProfile: true,
  socialInstagram: '',
  socialFacebook: '',
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
        registrationEnabled: map['registration_enabled'] ?? true,
        homepageBestsellers: map['homepage_bestsellers'] ?? false,
        homepageReviews: map['homepage_reviews'] ?? false,
        homepagePhilosophy: map['homepage_philosophy'] ?? true,
        homepageAbout: map['homepage_about'] ?? true,
        requirePhone: map['require_phone'] ?? false,
        requireAddress: map['require_address'] ?? false,
        guestCheckout: map['guest_checkout'] ?? true,
        autoSaveProfile: map['auto_save_profile'] ?? true,
        isLoaded: true,
      });

      // Fetch text-based settings separately
      const textMap = Object.fromEntries(data.map(r => [r.key, (r as any).text_value]));
      set({
        socialInstagram: textMap['social_instagram'] ?? '',
        socialFacebook: textMap['social_facebook'] ?? '',
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

  setRegistrationEnabled: async (enabled) => {
    const old = get().registrationEnabled;
    set({ registrationEnabled: enabled });
    await supabase
      .from('store_settings')
      .upsert({ key: 'registration_enabled', value: enabled, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    logSettingsChange('registration_enabled', old, enabled);
  },

  setHomepageSetting: async (key, enabled) => {
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

  setProfileSetting: async (key, enabled) => {
    const stateKey = PROFILE_SETTING_MAP[key];
    if (stateKey) {
      set({ [stateKey]: enabled } as any);
    }
    await supabase
      .from('store_settings')
      .upsert({ key, value: enabled, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    logSettingsChange(key, !enabled, enabled);
  },

  setSocialSetting: async (key, value) => {
    const stateKey = key === 'social_instagram' ? 'socialInstagram' : 'socialFacebook';
    const old = get()[stateKey];
    set({ [stateKey]: value } as any);
    await supabase
      .from('store_settings')
      .upsert({ key, value: true, text_value: value, updated_at: new Date().toISOString() } as any, { onConflict: 'key' });
    logSettingsChange(key, old, value);
  },
}));

// Realtime subscription for instant sync across tabs/users
supabase
  .channel('store-settings-realtime')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'store_settings' }, (payload) => {
    const { key, value } = payload.new as { key: string; value: boolean };
    if (key === 'site_active') useStoreSettings.setState({ siteActive: value });
    if (key === 'checkout_enabled') useStoreSettings.setState({ checkoutEnabled: value });
    if (key === 'registration_enabled') useStoreSettings.setState({ registrationEnabled: value });
    if (key === 'homepage_bestsellers') useStoreSettings.setState({ homepageBestsellers: value });
    if (key === 'homepage_reviews') useStoreSettings.setState({ homepageReviews: value });
    if (key === 'homepage_philosophy') useStoreSettings.setState({ homepagePhilosophy: value });
    if (key === 'homepage_about') useStoreSettings.setState({ homepageAbout: value });
    if (key === 'require_phone') useStoreSettings.setState({ requirePhone: value });
    if (key === 'require_address') useStoreSettings.setState({ requireAddress: value });
    if (key === 'guest_checkout') useStoreSettings.setState({ guestCheckout: value });
    if (key === 'auto_save_profile') useStoreSettings.setState({ autoSaveProfile: value });
    const textVal = (payload.new as any).text_value;
    if (key === 'social_instagram') useStoreSettings.setState({ socialInstagram: textVal ?? '' });
    if (key === 'social_facebook') useStoreSettings.setState({ socialFacebook: textVal ?? '' });
  })
  .subscribe();
