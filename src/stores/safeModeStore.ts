import { create } from 'zustand';
import { toast } from 'sonner';

export type SafeModeReason = 'multiple_failures' | 'regression' | 'critical_error';

export interface SafeModeEvent {
  reason: SafeModeReason;
  detail: string;
  timestamp: string;
  sourceTaskId?: string;
}

interface SafeModeState {
  active: boolean;
  activatedAt: string | null;
  events: SafeModeEvent[];
  /** Problem areas that triggered safe mode */
  isolatedAreas: string[];
  /** Activate safe mode */
  activate: (reason: SafeModeReason, detail: string, area?: string, sourceTaskId?: string) => void;
  /** Deactivate (manual override) */
  deactivate: () => void;
  /** Check recent failures and auto-activate if threshold met */
  evaluateThreshold: (failureCount: number, regressionCount: number) => void;
  clearEvents: () => void;
}

const FAILURE_THRESHOLD = 3;
const REGRESSION_THRESHOLD = 2;

export const useSafeModeStore = create<SafeModeState>((set, get) => ({
  active: false,
  activatedAt: null,
  events: [],
  isolatedAreas: [],

  activate: (reason, detail, area, sourceTaskId) => {
    const state = get();
    const event: SafeModeEvent = {
      reason, detail,
      timestamp: new Date().toISOString(),
      sourceTaskId,
    };

    const newAreas = area && !state.isolatedAreas.includes(area)
      ? [...state.isolatedAreas, area]
      : state.isolatedAreas;

    if (!state.active) {
      toast.error('⚠️ Safe Mode aktiverat — icke-kritiska uppgifter pausade', { duration: 8000 });
    }

    set({
      active: true,
      activatedAt: state.activatedAt || new Date().toISOString(),
      events: [...state.events, event],
      isolatedAreas: newAreas,
    });
  },

  deactivate: () => {
    toast.success('Safe Mode avaktiverat — normal drift återställd');
    set({ active: false, activatedAt: null, isolatedAreas: [] });
  },

  evaluateThreshold: (failureCount, regressionCount) => {
    const state = get();
    if (state.active) return;

    if (failureCount >= FAILURE_THRESHOLD) {
      state.activate('multiple_failures', `${failureCount} misslyckade uppgifter detekterade`);
    } else if (regressionCount >= REGRESSION_THRESHOLD) {
      state.activate('regression', `${regressionCount} regressioner detekterade`);
    }
  },

  clearEvents: () => set({ events: [] }),
}));
