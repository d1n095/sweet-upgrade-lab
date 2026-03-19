import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ShoppingBag, Truck, Shield, CreditCard, AlertTriangle, Lock, RotateCcw, Clock, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useCartStore } from '@/stores/cartStore';
import { useLanguage, getContentLang } from '@/context/LanguageContext';
import { storeConfig } from '@/config/storeConfig';
import PaymentMethods from '@/components/trust/PaymentMethods';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useStoreSettings } from '@/stores/storeSettingsStore';
import { logActivity } from '@/utils/activityLogger';
import { trackCheckoutStart, trackCheckoutStep, trackCheckoutAbandon, trackEvent } from '@/utils/analyticsTracker';
import { useAuth } from '@/hooks/useAuth';

// Swedish postal code → city lookup (common codes)
const ZIP_CITY_MAP: Record<string, string> = {
  '10': 'Stockholm', '11': 'Stockholm', '12': 'Stockholm', '13': 'Stockholm',
  '16': 'Stockholm', '17': 'Stockholm', '18': 'Stockholm', '19': 'Stockholm',
  '20': 'Malmö', '21': 'Malmö', '22': 'Lund',
  '25': 'Helsingborg', '30': 'Halmstad',
  '40': 'Göteborg', '41': 'Göteborg', '42': 'Göteborg', '43': 'Göteborg',
  '50': 'Borås', '55': 'Jönköping', '58': 'Linköping', '60': 'Norrköping',
  '70': 'Örebro', '72': 'Västerås', '75': 'Uppsala', '80': 'Gävle',
  '85': 'Sundsvall', '90': 'Umeå', '95': 'Luleå',
};

// Hook to get shipping settings from DB
const useShippingConfig = () => {
  const [config, setConfig] = useState({ cost: 39 as number, freeThreshold: 500 as number });
  useEffect(() => {
    supabase
      .from('store_settings')
      .select('key, text_value')
      .in('key', ['shipping_cost', 'free_shipping_threshold'])
      .then(({ data }) => {
        if (data) {
          const map = Object.fromEntries(data.map(r => [r.key, r.text_value]));
          setConfig({
            cost: map['shipping_cost'] ? parseFloat(map['shipping_cost']) : 39,
            freeThreshold: map['free_shipping_threshold'] ? parseFloat(map['free_shipping_threshold']) : 500,
          });
        }
      });
  }, []);
  return config;
};

interface FieldErrors {
  email?: string;
  name?: string;
  address?: string;
  zip?: string;
  city?: string;
}

const Checkout = () => {
  const { language } = useLanguage();
  const cl = getContentLang(language);
  const cartStore = useCartStore();
  const items = cartStore?.items || [];
  const { checkoutEnabled } = useStoreSettings();
  const { user } = useAuth();
  const shippingConfig = useShippingConfig();
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [selectedPayment, setSelectedPayment] = useState<'card' | 'klarna'>('card');
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [form, setForm] = useState({
    email: '',
    name: '',
    address: '',
    zip: '',
    city: '',
    country: 'SE',
    phone: '',
  });

  const completedRef = useRef(false);

  // Auto-fill from logged-in user's profile
  useEffect(() => {
    if (profileLoaded || !user) return;

    const loadProfileData = async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('first_name, last_name, full_name, phone, address, zip, city, country')
          .eq('user_id', user.id)
          .maybeSingle();

        const d = data as any;
        const profileName = d?.first_name && d?.last_name
          ? `${d.first_name} ${d.last_name}`
          : d?.full_name || '';

        setForm(prev => ({
          ...prev,
          email: user.email || prev.email,
          name: profileName || prev.name,
          phone: d?.phone || prev.phone,
          address: d?.address || prev.address,
          zip: d?.zip || prev.zip,
          city: d?.city || prev.city,
          country: d?.country || prev.country,
        }));
      } catch {
        setForm(prev => ({ ...prev, email: user.email || prev.email }));
      }
      setProfileLoaded(true);
    };

    loadProfileData();
  }, [user, profileLoaded]);


  const subtotal = useMemo(() =>
    items.reduce((sum, item) => sum + (parseFloat(item.price.amount) * item.quantity), 0),
    [items]
  );
  const shippingCost = subtotal >= shippingConfig.freeThreshold ? 0 : shippingConfig.cost;
  const total = subtotal + shippingCost;

  const isSv = cl === 'sv';

  const t = useMemo(() => ({
    title: isSv ? 'Kassa' : 'Checkout',
    orderSummary: isSv ? 'Din beställning' : 'Your order',
    shippingInfo: isSv ? 'Leveransinformation' : 'Shipping information',
    email: isSv ? 'E-post' : 'Email',
    name: isSv ? 'Fullständigt namn' : 'Full name',
    address: isSv ? 'Adress' : 'Address',
    zip: isSv ? 'Postnummer' : 'Postal code',
    city: isSv ? 'Stad' : 'City',
    phone: isSv ? 'Telefon (valfritt)' : 'Phone (optional)',
    subtotal: isSv ? 'Delsumma' : 'Subtotal',
    shipping: isSv ? 'Frakt' : 'Shipping',
    freeShipping: isSv ? 'Fri frakt' : 'Free shipping',
    total: isSv ? 'Totalt' : 'Total',
    paySecurely: isSv ? 'Betala säkert' : 'Pay securely',
    processing: isSv ? 'Bearbetar...' : 'Processing...',
    backToCart: isSv ? 'Tillbaka' : 'Back',
    emptyCart: isSv ? 'Din kundvagn är tom' : 'Your cart is empty',
    goToShop: isSv ? 'Gå till butiken' : 'Go to shop',
    deliveryEstimate: isSv ? 'Leverans: 7–10 arbetsdagar' : 'Delivery: 7–10 business days',
    securePayment: isSv ? 'Säker betalning' : 'Secure payment',
    freeShippingBadge: isSv ? 'Fri frakt' : 'Free shipping',
    guarantee: isSv ? '30 dagars garanti' : '30-day guarantee',
    encrypted: isSv ? 'Din betalning är krypterad och säker' : 'Your payment is encrypted and secure',
    returnPolicy: isSv ? 'Returpolicy' : 'Return policy',
    lowStock: isSv ? 'Endast {n} kvar' : 'Only {n} left',
    fillAllFields: isSv ? 'Fyll i alla obligatoriska fält' : 'Please fill in all required fields',
    invalidCart: isSv ? 'Kundvagnen är ogiltig. Uppdatera sidan och försök igen.' : 'Cart data is invalid. Refresh and try again.',
    hydrationTimeout: isSv ? 'Kundvagnen laddades inte klart. Försök igen.' : 'Cart hydration timed out. Please try again.',
    errorEmail: isSv ? 'Ange en giltig e-postadress' : 'Enter a valid email address',
    errorName: isSv ? 'Ange ditt namn' : 'Enter your name',
    errorAddress: isSv ? 'Ange din adress' : 'Enter your address',
    errorZip: isSv ? 'Ange postnummer' : 'Enter postal code',
    errorCity: isSv ? 'Ange stad' : 'Enter city',
    checkoutFailed: isSv ? 'Betalningen kunde inte genomföras. Försök igen.' : 'Payment could not be processed. Please try again.',
    checkoutTimeout: isSv ? 'Checkout tog för lång tid. Försök igen.' : 'Checkout timed out. Please retry.',
    invalidSession: isSv ? 'Kunde inte skapa betalningssession. Försök igen.' : 'Could not create payment session. Please retry.',
    retry: isSv ? 'Försök igen' : 'Retry',
    qty: isSv ? 'Antal' : 'Qty',
  }), [isSv]);

  const formatPrice = (amount: number) =>
    new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', minimumFractionDigits: 0 }).format(amount);

  const validateField = useCallback((field: string, value: string): string | undefined => {
    switch (field) {
      case 'email':
        return !value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? t.errorEmail : undefined;
      case 'name':
        return !value.trim() ? t.errorName : undefined;
      case 'address':
        return !value.trim() ? t.errorAddress : undefined;
      case 'zip':
        return !value.trim() ? t.errorZip : undefined;
      case 'city':
        return !value.trim() ? t.errorCity : undefined;
      default:
        return undefined;
    }
  }, [t]);


  const handleBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    const error = validateField(field, form[field as keyof typeof form]);
    setErrors(prev => ({ ...prev, [field]: error }));
  };

  const updateField = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));

    if (field === 'zip' && value.length >= 2) {
      const prefix = value.substring(0, 2);
      const city = ZIP_CITY_MAP[prefix];
      if (city && !form.city) {
        setForm(prev => ({ ...prev, city }));
      }
    }

    if (touched[field]) {
      const error = validateField(field, value);
      setErrors(prev => ({ ...prev, [field]: error }));
    }
  };

  // DEBUG state
  const [debugInfo, setDebugInfo] = useState<Record<string, any>>({});
  const [debugSteps, setDebugSteps] = useState<string[]>([]);

  const addDebugStep = (step: string) => {
    const ts = new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setDebugSteps(prev => [...prev, `[${ts}] ${step}`]);
    console.log(`=== ${step} ===`);
  };

  const startCheckout = useCallback(async () => {
    setDebugSteps([]);
    addDebugStep('✅ REAL PAY HANDLER TRIGGERED');
    setCheckoutError(null);

    try {
      addDebugStep('📡 CALLING CHECKOUT API');
      const checkoutItems = items.map(item => ({
        id: (item.product as any).dbId || item.variantId,
        title: item.product.node.title,
        price: Number.parseFloat(item.price.amount),
        quantity: item.quantity,
        image: item.product.node.images?.edges?.[0]?.node?.url || '',
      }));

      const checkoutBody = {
        items: checkoutItems,
        shipping: {
          name: form.name,
          address: form.address,
          zip: form.zip,
          city: form.city,
          country: form.country,
          phone: form.phone,
        },
        email: form.email,
        language: cl,
        paymentMethod: selectedPayment,
      };

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      addDebugStep(`🔑 Auth token: ${accessToken ? 'YES' : 'NO'}`);

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(checkoutBody),
      });

      addDebugStep(`📥 FETCH COMPLETE — HTTP ${res.status}`);

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      addDebugStep(`📦 Response keys: ${data ? Object.keys(data).join(', ') : 'NULL'}`);

      if (!res.ok) {
        throw new Error(data?.error || `HTTP_${res.status}`);
      }

      const url = data?.sessionUrl || data?.url;
      addDebugStep(`🔗 URL: ${url ? url.substring(0, 60) + '…' : 'MISSING'}`);

      if (!url) {
        setDebugInfo({
          step: 'no_stripe_url',
          status: res.status,
          data,
          url: null,
          error: 'No Stripe URL returned',
        });
        addDebugStep('❌ No Stripe URL in response!');
        throw new Error('No Stripe URL returned');
      }

      completedRef.current = true;
      addDebugStep('🚀 REDIRECT LINE REACHED — redirecting NOW');
      window.location.href = url;
    } catch (err: any) {
      console.error('Checkout redirect failed:', err);

      const message = typeof err?.message === 'string' && err.message.length > 0
        ? err.message
        : t.checkoutFailed;

      setCheckoutError(message);
      setDebugInfo(prev => ({ ...prev, step: 'failed', error: message }));

      logActivity({
        log_type: 'error',
        category: 'payment',
        message: 'Checkout failed',
        details: {
          error: message,
          email: form.email,
          payment_method: selectedPayment,
        },
      });

      toast.error(message);
    }
  }, [cl, form, items, selectedPayment, t.checkoutFailed, total]);

  const handleSubmit = (event?: React.FormEvent | React.MouseEvent) => {
    event?.preventDefault();
    void startCheckout();
  };

  // Get stock info for low-stock badges
  const getItemStock = (item: any) => {
    const product = item.product as any;
    if (product?.dbId && product?.node) {
      const stock = product.node.variants?.edges?.[0]?.node?.availableForSale;
      // We don't have exact stock here, but we can check from the product data
      return null;
    }
    return null;
  };

  // Track checkout page view with item details (must be before early returns)
  useEffect(() => {
    if (items.length > 0) {
      const itemDetails = items.map(item => ({
        title: item.product.node.title,
        price: parseFloat(item.price.amount),
        quantity: item.quantity,
      }));
      trackCheckoutStart(items.length, total);
      trackEvent('checkout_start_detail', { items: itemDetails, total });
    }
    return () => {
      if (items.length > 0 && !completedRef.current) {
        const abandonItems = items.map(item => ({
          title: item.product.node.title,
          price: parseFloat(item.price.amount),
          quantity: item.quantity,
        }));
        trackCheckoutAbandon('checkout_page', items.length, total);
        trackEvent('checkout_abandon_detail', { items: abandonItems, total });
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // No hydration blocking - checkout always renders

  if (!checkoutEnabled) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="max-w-md text-center px-4">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-secondary flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-muted-foreground" />
          </div>
          <h1 className="text-xl font-semibold mb-3">
            {isSv ? 'Kassan är tillfälligt stängd' : 'Checkout is temporarily closed'}
          </h1>
          <p className="text-muted-foreground mb-6">
            {isSv ? 'Vi kan just nu inte ta emot beställningar. Försök igen senare.' : 'We cannot accept orders at this time. Please try again later.'}
          </p>
          <Button asChild>
            <Link to="/produkter">{isSv ? 'Tillbaka till produkter' : 'Back to products'}</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="max-w-lg text-center px-4">
          <ShoppingBag className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-4">{t.emptyCart}</h1>
          <Button asChild><Link to="/produkter">{t.goToShop}</Link></Button>
        </div>
      </div>
    );
  }

  const renderFieldError = (field: keyof FieldErrors) => {
    if (!touched[field] || !errors[field]) return null;
    return <p className="text-xs text-destructive mt-1">{errors[field]}</p>;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Debug panel – only visible when debug data exists or an error occurred */}
      {(Object.keys(debugInfo).length > 0 || checkoutError) && (
        <div className="fixed top-16 right-4 z-[9999] max-w-sm bg-card border border-border rounded-lg shadow-xl p-3 text-xs font-mono space-y-1.5 max-h-72 overflow-auto">
          <div className="flex items-center justify-between mb-1">
            <p className="font-bold text-foreground flex items-center gap-1">🔍 Checkout Debug</p>
            <button onClick={() => { setDebugInfo({}); setCheckoutError(null); }} className="text-muted-foreground hover:text-foreground">✕</button>
          </div>
          {debugInfo.step && (
            <div className={`px-2 py-1 rounded text-[11px] ${
              debugInfo.step === 'redirecting' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
              debugInfo.step === 'failed' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
              'bg-secondary text-muted-foreground'
            }`}>
              Steg: <strong>{debugInfo.step}</strong>
            </div>
          )}
          {debugInfo.data?.orderId && (
            <p className="text-muted-foreground">orderId: <span className="text-foreground">{debugInfo.data.orderId}</span></p>
          )}
          {debugInfo.data?.sessionId && (
            <p className="text-muted-foreground">sessionId: <span className="text-foreground">{String(debugInfo.data.sessionId).slice(0, 30)}…</span></p>
          )}
          {(debugInfo.url || debugInfo.data?.sessionUrl || debugInfo.data?.url) && (
            <p className="text-muted-foreground">url: <span className="text-green-600 dark:text-green-400 break-all">{String(debugInfo.url || debugInfo.data?.sessionUrl || debugInfo.data?.url)}</span></p>
          )}
          {debugInfo.error && (
            <p className="text-red-600 dark:text-red-400">error: {debugInfo.error}</p>
          )}
          {debugInfo.data?.warnings && (
            <p className="text-yellow-600 dark:text-yellow-400">warnings: {JSON.stringify(debugInfo.data.warnings)}</p>
          )}
          {debugInfo.status && (
            <p className="text-muted-foreground">HTTP: <span className="text-foreground">{debugInfo.status}</span></p>
          )}
          {debugInfo.data && (
            <details className="text-muted-foreground">
              <summary className="cursor-pointer">Full response JSON</summary>
              <pre className="mt-1 whitespace-pre-wrap break-all text-[10px] text-foreground">{JSON.stringify(debugInfo.data, null, 2)}</pre>
            </details>
          )}
          <p className="text-muted-foreground">items: {debugInfo.itemCount || items.length} | total: {total} SEK</p>
          {/* Test redirect capability */}
          <button
            onClick={() => { console.log('TEST REDIRECT CLICKED'); window.location.href = 'https://checkout.stripe.com'; }}
            className="w-full mt-1 px-2 py-1 bg-primary text-primary-foreground rounded text-[10px] hover:opacity-90"
          >
            🧪 TEST: Stripe Redirect
          </button>
        </div>
      )}
      {/* Minimal checkout header — distraction-free */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between max-w-5xl">
          <Link
            to="/produkter"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {t.backToCart}
          </Link>
          <div className="flex items-center gap-2 text-sm font-medium">
            <Lock className="w-3.5 h-3.5 text-accent" />
            {t.securePayment}
          </div>
        </div>
      </header>

      <main className="pt-20 pb-32 lg:pb-20">
        <div className="container mx-auto px-4 max-w-5xl">
          <h1 className="font-display text-2xl md:text-3xl font-bold mb-2">{t.title}</h1>

          {/* Trust strip */}
          <div className="flex flex-wrap items-center gap-3 mb-8 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-accent" />{t.securePayment}</span>
            <span className="text-border">•</span>
            <span className="inline-flex items-center gap-1.5"><Truck className="w-3.5 h-3.5 text-accent" />{shippingCost === 0 ? t.freeShippingBadge : t.deliveryEstimate}</span>
            <span className="text-border">•</span>
            <span className="inline-flex items-center gap-1.5"><RotateCcw className="w-3.5 h-3.5 text-accent" />{t.guarantee}</span>
          </div>

          <div className="grid lg:grid-cols-5 gap-8">
            {/* Left: Shipping form */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="lg:col-span-3"
            >
              <form id="checkout-form" onSubmit={handleSubmit} className="space-y-6">
                <div className="bg-card border border-border rounded-2xl p-6">
                  <h2 className="font-display text-lg font-semibold mb-5 flex items-center gap-2">
                    <Truck className="w-5 h-5 text-primary" />
                    {t.shippingInfo}
                  </h2>

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="email">{t.email} *</Label>
                      <Input
                        id="email"
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        autoCapitalize="off"
                        required
                        value={form.email}
                        onChange={(e) => updateField('email', e.target.value)}
                        onBlur={() => handleBlur('email')}
                        placeholder="namn@example.com"
                        className={touched.email && errors.email ? 'border-destructive' : ''}
                      />
                      {renderFieldError('email')}
                    </div>

                    <div>
                      <Label htmlFor="name">{t.name} *</Label>
                      <Input
                        id="name"
                        autoComplete="name"
                        autoCapitalize="words"
                        required
                        value={form.name}
                        onChange={(e) => updateField('name', e.target.value)}
                        onBlur={() => handleBlur('name')}
                        className={touched.name && errors.name ? 'border-destructive' : ''}
                      />
                      {renderFieldError('name')}
                    </div>

                    <div>
                      <Label htmlFor="address">{t.address} *</Label>
                      <Input
                        id="address"
                        autoComplete="street-address"
                        required
                        value={form.address}
                        onChange={(e) => updateField('address', e.target.value)}
                        onBlur={() => handleBlur('address')}
                        className={touched.address && errors.address ? 'border-destructive' : ''}
                      />
                      {renderFieldError('address')}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="zip">{t.zip} *</Label>
                        <Input
                          id="zip"
                          inputMode="numeric"
                          autoComplete="postal-code"
                          required
                          value={form.zip}
                          onChange={(e) => updateField('zip', e.target.value)}
                          onBlur={() => handleBlur('zip')}
                          placeholder="123 45"
                          className={touched.zip && errors.zip ? 'border-destructive' : ''}
                        />
                        {renderFieldError('zip')}
                      </div>
                      <div>
                        <Label htmlFor="city">{t.city} *</Label>
                        <Input
                          id="city"
                          autoComplete="address-level2"
                          required
                          value={form.city}
                          onChange={(e) => updateField('city', e.target.value)}
                          onBlur={() => handleBlur('city')}
                          className={touched.city && errors.city ? 'border-destructive' : ''}
                        />
                        {renderFieldError('city')}
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="phone">{t.phone}</Label>
                      <Input
                        id="phone"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        value={form.phone}
                        onChange={(e) => updateField('phone', e.target.value)}
                      />
                    </div>

                    {/* Payment method selector */}
                    <div className="pt-2">
                      <Label className="mb-3 block">{isSv ? 'Betalningsmetod' : 'Payment method'} *</Label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setSelectedPayment('card')}
                          className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all min-h-[100px] ${
                            selectedPayment === 'card'
                              ? 'border-primary bg-primary/5 shadow-sm'
                              : 'border-border hover:border-primary/40'
                          }`}
                        >
                          {selectedPayment === 'card' && (
                            <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                              <Check className="w-3 h-3 text-primary-foreground" />
                            </div>
                          )}
                          <CreditCard className="w-6 h-6 text-foreground" />
                          <span className="text-sm font-medium">{isSv ? 'Kort' : 'Card'}</span>
                          <span className="text-[10px] text-muted-foreground leading-tight text-center">
                            Visa, Mastercard, Apple Pay, Google Pay
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSelectedPayment('klarna')}
                          className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all min-h-[100px] ${
                            selectedPayment === 'klarna'
                              ? 'border-primary bg-primary/5 shadow-sm'
                              : 'border-border hover:border-primary/40'
                          }`}
                        >
                          {selectedPayment === 'klarna' && (
                            <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                              <Check className="w-3 h-3 text-primary-foreground" />
                            </div>
                          )}
                          <div className="w-6 h-6 flex items-center justify-center">
                            <span className="text-base font-black tracking-tight text-primary" style={{ fontFamily: 'system-ui' }}>K.</span>
                          </div>
                          <span className="text-sm font-medium">Klarna</span>
                          <span className="text-[10px] text-muted-foreground leading-tight text-center">
                            {isSv ? 'Faktura, delbetalning' : 'Pay later, installments'}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Desktop: encryption + returns under form */}
                <div className="hidden lg:block space-y-3">
                  <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                    <Lock className="w-3 h-3" />
                    {t.encrypted}
                  </div>
                  <div className="text-center">
                    <Link
                      to="/policies/returns"
                      className="text-xs text-muted-foreground hover:text-foreground underline transition-colors"
                    >
                      {t.returnPolicy}
                    </Link>
                  </div>
                </div>
              </form>
            </motion.div>

            {/* Right: Order summary — sticky on desktop */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="lg:col-span-2"
            >
              <div className="bg-card border border-border rounded-2xl p-6 lg:sticky lg:top-20">
                <h2 className="font-display text-lg font-semibold mb-5 flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-primary" />
                  {t.orderSummary}
                </h2>

                <div className="space-y-4 mb-6">
                  {items.map((item) => (
                    <div key={item.variantId} className="flex gap-3">
                      <div className="w-14 h-14 rounded-lg bg-secondary/50 overflow-hidden flex-shrink-0">
                        {item.product.node.images?.edges?.[0]?.node && (
                          <img
                            src={item.product.node.images.edges[0].node.url}
                            alt={item.product.node.title}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium truncate">{item.product.node.title}</h4>
                        <p className="text-xs text-muted-foreground">{t.qty}: {item.quantity}</p>
                      </div>
                      <span className="text-sm font-semibold whitespace-nowrap">
                        {formatPrice(parseFloat(item.price.amount) * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-border pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t.subtotal}</span>
                    <span>{formatPrice(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t.shipping}</span>
                    <span className={shippingCost === 0 ? 'text-accent font-medium' : ''}>
                      {shippingCost === 0 ? t.freeShipping : formatPrice(shippingCost)}
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline pt-3 border-t border-border">
                    <span className="text-base font-bold">{t.total}</span>
                    <span className="text-2xl font-bold text-primary">{formatPrice(total)}</span>
                  </div>
                </div>

                {/* Delivery estimate */}
                <div className="flex items-center gap-2 mt-4 p-3 rounded-xl bg-secondary/40 border border-border/50">
                  <Clock className="w-4 h-4 text-accent shrink-0" />
                  <span className="text-xs text-muted-foreground">{t.deliveryEstimate}</span>
                </div>

                {checkoutError && (
                  <div className="mt-5 rounded-xl border border-destructive/40 bg-destructive/5 p-3 space-y-2">
                    <p className="text-xs text-destructive">{checkoutError}</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleSubmit}
                    >
                      {t.retry}
                    </Button>
                  </div>
                )}

                {/* Desktop pay button */}
                <div className="hidden lg:block mt-5 space-y-3">
                  <Button
                    type="button"
                    size="lg"
                    className="w-full h-14 text-base font-semibold"
                    onClick={handleSubmit}
                  >
                    <Lock className="w-4 h-4 mr-2" />{t.paySecurely} — {formatPrice(total)}
                  </Button>
                </div>

                <div className="mt-4">
                  <PaymentMethods />
                </div>

                <div className="mt-3 text-center">
                  <Link
                    to="/policies/returns"
                    className="text-xs text-muted-foreground hover:text-foreground underline transition-colors lg:hidden"
                  >
                    {t.returnPolicy}
                  </Link>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </main>

      {/* Sticky mobile pay button */}
      <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-background/95 backdrop-blur-md border-t border-border px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] space-y-2">
        {checkoutError && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-2">
            <p className="text-[11px] text-destructive">{checkoutError}</p>
          </div>
        )}
        <Button
          type="button"
          size="lg"
          className="w-full h-12 text-sm font-semibold"
          onClick={handleSubmit}
        >
          <Lock className="w-3.5 h-3.5 mr-1.5 shrink-0" /><span className="truncate">{t.paySecurely}</span><span className="ml-1 shrink-0">{formatPrice(total)}</span>
        </Button>
      </div>
    </div>
  );
};

export default Checkout;
