import { create } from 'zustand';

export type ToggleablePage = 'affiliate' | 'business' | 'suggest-product' | 'donations' | 'whats-new';

const STORAGE_KEY = 'page_visibility';

const defaultVisibility: Record<ToggleablePage, boolean> = {
  'affiliate': false,
  'business': false,
  'suggest-product': false,
  'donations': false,
  'whats-new': false,
};

function loadVisibility(): Record<ToggleablePage, boolean> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...defaultVisibility, ...JSON.parse(stored) };
    }
  } catch {}
  return { ...defaultVisibility };
}

interface PageVisibilityState {
  visibility: Record<ToggleablePage, boolean>;
  isVisible: (page: ToggleablePage) => boolean;
  setVisibility: (page: ToggleablePage, visible: boolean) => void;
}

export const usePageVisibility = create<PageVisibilityState>((set, get) => ({
  visibility: loadVisibility(),
  isVisible: (page) => get().visibility[page] ?? false,
  setVisibility: (page, visible) => {
    const updated = { ...get().visibility, [page]: visible };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    set({ visibility: updated });
  },
}));
