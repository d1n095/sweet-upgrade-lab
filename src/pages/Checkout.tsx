import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import AddressAutocomplete from '@/components/checkout/AddressAutocomplete';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ShoppingBag, Truck, Shield, Lock, RotateCcw, Clock, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCartStore } from '@/stores/cartStore';
import { useLanguage, getContentLang } from '@/context/LanguageContext';
import PaymentMethods from '@/components/trust/PaymentMethods';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useStoreSettings } from '@/stores/storeSettingsStore';
import { logActivity } from '@/utils/activityLogger';
import { trackCheckoutStart, trackCheckoutAbandon, trackEvent } from '@/utils/analyticsTracker';
import { useAuth } from '@/hooks/useAuth';

// Swedish postal code → city lookup
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

const useShippingConfig = () => {
  const [config, setConfig] = useState({ cost: 39, freeThreshold: 500 });
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
  phone?: string;
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
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [form, setForm] = useState({
    email: '',
    name: '',
    careOf: '',
    company: '',
    address: '',
    apartment: '',
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
    careOf: 'c/o',
    company: isSv ? 'Företag (valfritt)' : 'Company (optional)',
    address: isSv ? 'Gatuadress' : 'Street address',
    apartment: isSv ? 'Lägenhetsnummer (valfritt)' : 'Apartment (optional)',
    zip: isSv ? 'Postnummer' : 'Postal code',
    city: isSv ? 'Stad' : 'City',
    phone: isSv ? 'Telefon *' : 'Phone *',
    subtotal: isSv ? 'Delsumma' : 'Subtotal',
    shipping: isSv ? 'Frakt' : 'Shipping',
    freeShipping: isSv ? 'Fri frakt' : 'Free shipping',
    total: isSv ? 'Totalt' : 'Total',
    paySecurely: isSv ? 'Betala säkert – få det inom 1–3 dagar' : 'Pay securely – get it within 1–3 days',
    backToCart: isSv ? 'Tillbaka' : 'Back',
    emptyCart: isSv ? 'Din kundvagn är tom' : 'Your cart is empty',
    goToShop: isSv ? 'Gå till butiken' : 'Go to shop',
    deliveryEstimate: isSv ? 'Leverans: 7–10 arbetsdagar' : 'Delivery: 7–10 business days',
    securePayment: isSv ? 'Säker betalning' : 'Secure payment',
    freeShippingBadge: isSv ? 'Fri frakt' : 'Free shipping',
    guarantee: isSv ? '30 dagars garanti' : '30-day guarantee',
    encrypted: isSv ? 'Din betalning är krypterad och säker' : 'Your payment is encrypted and secure',
    returnPolicy: isSv ? 'Returpolicy' : 'Return policy',
    errorEmail: isSv ? 'Ange en giltig e-postadress' : 'Enter a valid email address',
    errorName: isSv ? 'Ange ditt namn' : 'Enter your name',
    errorAddress: isSv ? 'Ange din adress' : 'Enter your address',
    errorZip: isSv ? 'Ange postnummer' : 'Enter postal code',
     errorCity: isSv ? 'Ange stad' : 'Enter city',
    errorPhone: isSv ? 'Ange telefonnummer' : 'Enter phone number',
    checkoutFailed: isSv ? 'Betalningen kunde inte genomföras. Försök igen.' : 'Payment could not be processed. Please try again.',
    checkoutTimeout: isSv ? 'Checkout tog för lång tid. Försök igen.' : 'Checkout timed out. Please retry.',
    retry: isSv ? 'Försök igen' : 'Retry',
    qty: isSv ? 'Antal' : 'Qty',
    standardShipping: isSv ? 'Standardleverans (7–10 dagar)' : 'Standard delivery (7–10 days)',
  }), [isSv]);

  const formatPrice = (amount: number) =>
    new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', minimumFractionDigits: 0 }).format(amount);

  const validateField = useCallback((field: string, value: string): string | undefined => {
    switch (field) {
      case 'email': return !value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? t.errorEmail : undefined;
      case 'name': return !value.trim() ? t.errorName : undefined;
      case 'address': return !value.trim() ? t.errorAddress : undefined;
      case 'zip': return !value.trim() ? t.errorZip : undefined;
      case 'city': return !value.trim() ? t.errorCity : undefined;
      case 'phone': {
        const digits = value.replace(/\D/g, '');
        return digits.length < 7 ? (t as any).errorPhone : undefined;
      }
      default: return undefined;
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

  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutStage, setCheckoutStage] = useState<'idle' | 'connecting' | 'creating' | 'redirecting'>('idle');

  const stageText = useMemo(() => ({
    connecting: isSv ? 'Ansluter till säker betalning…' : 'Connecting to secure payment…',
    creating: isSv ? 'Skapar betalningssession…' : 'Creating payment session…',
    redirecting: isSv ? 'Omdirigerar till Stripe…' : 'Redirecting to Stripe…',
  }), [isSv]);

  const startCheckout = useCallback(async () => {
    if (isCheckingOut) return;

    // Validate required fields first
    const requiredFields = ['email', 'name', 'address', 'zip', 'city', 'phone'] as const;
    const newErrors: FieldErrors = {};
    let hasErrors = false;
    for (const field of requiredFields) {
      const error = validateField(field, form[field]);
      if (error) {
        newErrors[field] = error;
        hasErrors = true;
      }
    }
    if (hasErrors) {
      setErrors(newErrors);
      setTouched(Object.fromEntries(requiredFields.map(f => [f, true])));
      toast.error(isSv ? 'Fyll i alla obligatoriska fält' : 'Please fill in all required fields');
      return;
    }

    setIsCheckingOut(true);
    setCheckoutStage('connecting');
    setCheckoutError(null);

    try {
      const checkoutItems = items.map((item, idx) => {
        // Defensive: handle corrupted cart items from localStorage
        const product = item?.product;
        const node = product?.node;
        const title = node?.title || item?.variantTitle || `Produkt ${idx + 1}`;
        const dbId = (product as any)?.dbId;
        const id = dbId || item?.variantId || `item_${idx}`;
        const price = Number.parseFloat(item?.price?.amount ?? '0');
        const image = node?.images?.edges?.[0]?.node?.url || '';

        return {
          id,
          title,
          price: Number.isFinite(price) && price > 0 ? price : 0,
          quantity: item?.quantity || 1,
          image,
        };
      }).filter(i => i.price > 0);

      if (checkoutItems.length === 0) {
        throw new Error(isSv ? 'Inga giltiga produkter i kundvagnen' : 'No valid products in cart');
      }

      // Build full address string including c/o, apartment, company
      const addressParts = [form.address];
      if (form.apartment) addressParts.push(form.apartment);
      const fullAddress = addressParts.join(', ');

      const checkoutBody = {
        items: checkoutItems,
        shipping: {
          name: form.name,
          address: fullAddress,
          careOf: form.careOf || '',
          company: form.company || '',
          zip: form.zip,
          city: form.city,
          country: form.country || 'SE',
          phone: form.phone || '',
        },
        email: form.email,
        language: cl,
      };

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      setCheckoutStage('creating');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(checkoutBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      let data: any = null;
      try { data = await res.json(); } catch { data = null; }

      if (!res.ok) throw new Error(data?.error || `HTTP_${res.status}`);

      const url = data?.sessionUrl || data?.url;
      if (!url) throw new Error('No Stripe URL returned');

      completedRef.current = true;
      setCheckoutStage('redirecting');
      window.location.href = url;
    } catch (err: any) {
      setIsCheckingOut(false);
      setCheckoutStage('idle');
      console.error('Checkout failed:', err);

      const message = err?.name === 'AbortError'
        ? t.checkoutTimeout
        : typeof err?.message === 'string' && err.message.length > 0
          ? err.message
          : t.checkoutFailed;

      setCheckoutError(message);
      logActivity({
        log_type: 'error',
        category: 'payment',
        message: 'Checkout failed',
        details: { error: message, email: form.email },
      });
      toast.error(message);
    }
  }, [cl, form, items, t, isCheckingOut, isSv, validateField]);

  const handleSubmit = (event?: React.FormEvent | React.MouseEvent) => {
    event?.preventDefault();
    void startCheckout();
  };

  // Track checkout page view
  useEffect(() => {
    if (items.length > 0) {
      trackCheckoutStart(items.length, total);
      trackEvent('checkout_start_detail', {
        items: items.map(item => ({
          title: item.product.node.title,
          price: parseFloat(item.price.amount),
          quantity: item.quantity,
        })),
        total,
      });
    }
    return () => {
      if (items.length > 0 && !completedRef.current) {
        trackCheckoutAbandon('checkout_page', items.length, total);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
          <Button asChild><Link to="/produkter">{isSv ? 'Tillbaka till produkter' : 'Back to products'}</Link></Button>
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
      {/* Minimal checkout header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between max-w-5xl">
          <Link to="/produkter" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
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
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="lg:col-span-3">
              <form id="checkout-form" onSubmit={handleSubmit} className="space-y-6">
                <div className="bg-card border border-border rounded-2xl p-6">
                  <h2 className="font-display text-lg font-semibold mb-5 flex items-center gap-2">
                    <Truck className="w-5 h-5 text-primary" />
                    {t.shippingInfo}
                  </h2>

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="email">{t.email} *</Label>
                      <Input id="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="off" required
                        value={form.email} onChange={(e) => updateField('email', e.target.value)} onBlur={() => handleBlur('email')}
                        placeholder="namn@example.com" className={touched.email && errors.email ? 'border-destructive' : ''} />
                      {renderFieldError('email')}
                    </div>

                    <div>
                      <Label htmlFor="name">{t.name} *</Label>
                      <Input id="name" autoComplete="name" autoCapitalize="words" required
                        value={form.name} onChange={(e) => updateField('name', e.target.value)} onBlur={() => handleBlur('name')}
                        className={touched.name && errors.name ? 'border-destructive' : ''} />
                      {renderFieldError('name')}
                    </div>

                    <div>
                      <Label htmlFor="company">{t.company}</Label>
                      <Input id="company" autoComplete="organization"
                        value={form.company} onChange={(e) => updateField('company', e.target.value)} />
                    </div>

                    <div>
                      <Label htmlFor="careOf">{t.careOf} ({isSv ? 'valfritt' : 'optional'})</Label>
                      <Input id="careOf" value={form.careOf} onChange={(e) => updateField('careOf', e.target.value)}
                        placeholder={isSv ? 'c/o Namn' : 'c/o Name'} />
                    </div>

                    <div>
                      <Label htmlFor="address">{t.address} *</Label>
                      <AddressAutocomplete
                        id="address"
                        value={form.address}
                        onChange={(val) => updateField('address', val)}
                        onSelect={(result) => {
                          setForm(prev => ({
                            ...prev,
                            address: result.address,
                            zip: result.postal_code || prev.zip,
                            city: result.city || prev.city,
                          }));
                          // Clear errors for auto-filled fields
                          setErrors(prev => ({ ...prev, address: undefined, zip: undefined, city: undefined }));
                        }}
                        onBlur={() => handleBlur('address')}
                        className={touched.address && errors.address ? 'border-destructive' : ''}
                      />
                      {renderFieldError('address')}
                    </div>

                    <div>
                      <Label htmlFor="apartment">{t.apartment}</Label>
                      <Input id="apartment" value={form.apartment} onChange={(e) => updateField('apartment', e.target.value)}
                        placeholder={isSv ? 'Lgh 1001' : 'Apt 1001'} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="zip">{t.zip} *</Label>
                        <Input id="zip" inputMode="numeric" autoComplete="postal-code" required
                          value={form.zip} onChange={(e) => updateField('zip', e.target.value)} onBlur={() => handleBlur('zip')}
                          placeholder="123 45" className={touched.zip && errors.zip ? 'border-destructive' : ''} />
                        {renderFieldError('zip')}
                      </div>
                      <div>
                        <Label htmlFor="city">{t.city} *</Label>
                        <Input id="city" autoComplete="address-level2" required
                          value={form.city} onChange={(e) => updateField('city', e.target.value)} onBlur={() => handleBlur('city')}
                          className={touched.city && errors.city ? 'border-destructive' : ''} />
                        {renderFieldError('city')}
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="phone">{t.phone}</Label>
                      <Input id="phone" type="tel" inputMode="tel" autoComplete="tel"
                        value={form.phone} onChange={(e) => updateField('phone', e.target.value)} />
                    </div>

                    {/* Single shipping method */}
                    <div className="pt-2">
                      <Label className="mb-3 block">{isSv ? 'Fraktmetod' : 'Shipping method'}</Label>
                      <div className="flex items-center gap-3 p-4 rounded-xl border-2 border-primary bg-primary/5">
                        <Truck className="w-5 h-5 text-primary shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{t.standardShipping}</p>
                          <p className="text-xs text-muted-foreground">{shippingCost === 0 ? t.freeShipping : formatPrice(shippingCost)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Desktop encryption info */}
                <div className="hidden lg:block space-y-3">
                  <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                    <Lock className="w-3 h-3" />{t.encrypted}
                  </div>
                  <div className="text-center">
                    <Link to="/policies/returns" className="text-xs text-muted-foreground hover:text-foreground underline transition-colors">
                      {t.returnPolicy}
                    </Link>
                  </div>
                </div>
              </form>
            </motion.div>

            {/* Right: Order summary */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="lg:col-span-2">
              <div className="bg-card border border-border rounded-2xl p-6 lg:sticky lg:top-20">
                <h2 className="font-display text-lg font-semibold mb-5 flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-primary" />{t.orderSummary}
                </h2>

                <div className="space-y-4 mb-6">
                  {items.map((item) => (
                    <div key={item.variantId} className="flex gap-3">
                      <div className="w-14 h-14 rounded-lg bg-secondary/50 overflow-hidden flex-shrink-0">
                        {item.product.node.images?.edges?.[0]?.node && (
                          <img src={item.product.node.images.edges[0].node.url} alt={item.product.node.title} className="w-full h-full object-cover" />
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

                <div className="flex items-center gap-2 mt-4 p-3 rounded-xl bg-secondary/40 border border-border/50">
                  <Clock className="w-4 h-4 text-accent shrink-0" />
                  <span className="text-xs text-muted-foreground">{t.deliveryEstimate}</span>
                </div>

                {checkoutError && (
                  <div className="mt-5 rounded-xl border border-destructive/40 bg-destructive/5 p-3 space-y-2">
                    <p className="text-xs text-destructive">{checkoutError}</p>
                    <Button type="button" variant="outline" size="sm" onClick={handleSubmit}>{t.retry}</Button>
                  </div>
                )}

                {/* Desktop pay button */}
                <div className="hidden lg:block mt-5 space-y-3">
                  <Button type="button" size="lg" className="w-full h-14 text-base font-semibold" onClick={handleSubmit} disabled={isCheckingOut}>
                    {isCheckingOut ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{stageText[checkoutStage as keyof typeof stageText] || stageText.connecting}</>
                    ) : (
                      <><Lock className="w-4 h-4 mr-2" />{t.paySecurely} — {formatPrice(total)}</>
                    )}
                  </Button>
                </div>

                <div className="mt-4"><PaymentMethods /></div>

                <div className="mt-3 text-center">
                  <Link to="/policies/returns" className="text-xs text-muted-foreground hover:text-foreground underline transition-colors lg:hidden">
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
        <Button type="button" size="lg" className="w-full h-12 text-sm font-semibold" onClick={handleSubmit} disabled={isCheckingOut}>
          {isCheckingOut ? (
            <><Loader2 className="w-3.5 h-3.5 mr-1.5 shrink-0 animate-spin" /><span className="truncate">{stageText[checkoutStage as keyof typeof stageText] || stageText.connecting}</span></>
          ) : (
            <><Lock className="w-3.5 h-3.5 mr-1.5 shrink-0" /><span className="truncate">{t.paySecurely}</span><span className="ml-1 shrink-0">{formatPrice(total)}</span></>
          )}
        </Button>
      </div>
    </div>
  );
};

export default Checkout;
