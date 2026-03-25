import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';

export interface PaymentMethod {
  id: string;
  name: string;
  enabled: boolean;
}

const DEFAULT_METHODS: PaymentMethod[] = [
  { id: 'visa', name: 'Visa', enabled: true },
  { id: 'mastercard', name: 'Mastercard', enabled: true },
  { id: 'klarna', name: 'Klarna', enabled: true },
  { id: 'swish', name: 'Swish', enabled: true },
  { id: 'applepay', name: 'Apple Pay', enabled: false },
  { id: 'googlepay', name: 'Google Pay', enabled: false },
  { id: 'paypal', name: 'PayPal', enabled: false },
  { id: 'revolut', name: 'Revolut', enabled: false },
];

interface PaymentMethodsStore {
  methods: PaymentMethod[];
  isLoaded: boolean;
  load: () => Promise<void>;
  toggle: (id: string) => Promise<void>;
  getEnabled: () => PaymentMethod[];
}

const DB_KEY = 'payment_methods';

export const usePaymentMethodsStore = create<PaymentMethodsStore>((set, get) => ({
  methods: DEFAULT_METHODS,
  isLoaded: false,

  load: async () => {
    try {
      const { data } = await supabase
        .from('store_settings')
        .select('text_value')
        .eq('key', DB_KEY)
        .maybeSingle();

      if (data?.text_value) {
        const saved = JSON.parse(data.text_value) as PaymentMethod[];
        // Merge with defaults to pick up new methods
        const merged = DEFAULT_METHODS.map(d => {
          const found = saved.find(p => p.id === d.id);
          return found ? { ...d, enabled: found.enabled } : d;
        });
        set({ methods: merged, isLoaded: true });
      } else {
        set({ isLoaded: true });
      }
    } catch {
      set({ isLoaded: true });
    }
  },

  toggle: async (id: string) => {
    const updated = get().methods.map(m => m.id === id ? { ...m, enabled: !m.enabled } : m);
    set({ methods: updated });
    await supabase
      .from('store_settings')
      .upsert(
        { key: DB_KEY, value: true, text_value: JSON.stringify(updated), updated_at: new Date().toISOString() } as any,
        { onConflict: 'key' }
      );
  },

  getEnabled: () => get().methods.filter(m => m.enabled),
}));

// Realtime sync
supabase
  .channel('payment-methods-realtime')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'store_settings' }, (payload) => {
    const row = payload.new as any;
    if (row?.key === DB_KEY && row?.text_value) {
      try {
        const saved = JSON.parse(row.text_value) as PaymentMethod[];
        const merged = DEFAULT_METHODS.map(d => {
          const found = saved.find(p => p.id === d.id);
          return found ? { ...d, enabled: found.enabled } : d;
        });
        usePaymentMethodsStore.setState({ methods: merged });
      } catch { /* ignore parse errors */ }
    }
  })
  .subscribe();
