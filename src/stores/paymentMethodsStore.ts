import { create } from 'zustand';

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
  { id: 'applepay', name: 'Apple Pay', enabled: true },
  { id: 'googlepay', name: 'Google Pay', enabled: true },
  { id: 'paypal', name: 'PayPal', enabled: false },
  { id: 'bancontact', name: 'Bancontact', enabled: false },
  { id: 'ideal', name: 'iDEAL', enabled: false },
  { id: 'giropay', name: 'Giropay', enabled: false },
  { id: 'eps', name: 'EPS', enabled: false },
  { id: 'p24', name: 'Przelewy24', enabled: false },
];

interface PaymentMethodsStore {
  methods: PaymentMethod[];
  isLoaded: boolean;
  load: () => void;
  toggle: (id: string) => void;
  getEnabled: () => PaymentMethod[];
}

export const usePaymentMethodsStore = create<PaymentMethodsStore>((set, get) => ({
  methods: DEFAULT_METHODS,
  isLoaded: false,
  load: () => {
    try {
      const saved = localStorage.getItem('payment_methods');
      if (saved) {
        const parsed = JSON.parse(saved) as PaymentMethod[];
        // Merge with defaults to pick up new methods
        const merged = DEFAULT_METHODS.map(d => {
          const found = parsed.find(p => p.id === d.id);
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
  toggle: (id: string) => {
    const updated = get().methods.map(m => m.id === id ? { ...m, enabled: !m.enabled } : m);
    set({ methods: updated });
    localStorage.setItem('payment_methods', JSON.stringify(updated));
  },
  getEnabled: () => get().methods.filter(m => m.enabled),
}));
