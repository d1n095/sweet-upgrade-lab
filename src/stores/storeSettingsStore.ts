import { create } from 'zustand';

const STORAGE_KEY = 'store_settings';

interface StoreSettings {
  maintenanceMode: boolean;
  checkoutEnabled: boolean;
}

const defaultSettings: StoreSettings = {
  maintenanceMode: false,
  checkoutEnabled: true,
};

function loadSettings(): StoreSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...defaultSettings, ...JSON.parse(stored) };
  } catch {}
  return { ...defaultSettings };
}

interface StoreSettingsState extends StoreSettings {
  setMaintenanceMode: (enabled: boolean) => void;
  setCheckoutEnabled: (enabled: boolean) => void;
}

export const useStoreSettings = create<StoreSettingsState>((set, get) => ({
  ...loadSettings(),
  setMaintenanceMode: (enabled) => {
    const updated = { ...get(), maintenanceMode: enabled };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ maintenanceMode: updated.maintenanceMode, checkoutEnabled: updated.checkoutEnabled }));
    set({ maintenanceMode: enabled });
  },
  setCheckoutEnabled: (enabled) => {
    const updated = { ...get(), checkoutEnabled: enabled };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ maintenanceMode: updated.maintenanceMode, checkoutEnabled: updated.checkoutEnabled }));
    set({ checkoutEnabled: enabled });
  },
}));
