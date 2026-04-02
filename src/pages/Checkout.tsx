import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import AddressAutocomplete from '@/components/checkout/AddressAutocomplete';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ShoppingBag, Truck, Shield, Lock, RotateCcw, Clock, Loader2, AlertTriangle, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCartStore } from '@/stores/cartStore';
import { useLanguage, getContentLang } from '@/context/LanguageContext';
import PaymentMethods from '@/components/trust/PaymentMethods';
import { supabase } from '@/integrations/supabase/client';
import { safeFetch } from '@/lib/safeInvoke';
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

const validateEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
const validateSwedishZip = (v: string) => /^\d{3}\s?\d{2}$/.test(v.trim());
const validatePhone = (v: string) => {
  const digits = v.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
};
const validateName = (v: string) => {
  const trimmed = v.trim();
  return trimmed.length >= 2 && trimmed.length <= 100 && /\s/.test(trimmed);
};

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
    email: '', name: '', careOf: '', company: '', address: '', apartment: '',
    zip: '', city: '', country: 'SE', phone: '',
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
  const amountToFreeShipping = shippingConfig.freeThreshold - subtotal;

  const isSv = cl === 'sv';

  const t = useMemo(() => ({
    secureCheckout: isSv ? 'Säker checkout' : 'Secure checkout',
    orderSummary: isSv ? 'Din beställning' : 'Your order',
    email: isSv ? 'E-post' : 'Email',
    name: isSv ? 'Fullständigt namn' : 'Full name',
    careOf: 'c/o',
    company: isSv ? 'Företag (valfritt)' : 'Company (optional)',
    address: isSv ? 'Gatuadress' : 'Street address',
    apartment: isSv ? 'Lägenhetsnummer (valfritt)' : 'Apartment (optional)',
    zip: isSv ? 'Postnummer' : 'Postal code',
    city: isSv ? 'Stad' : 'City',
    phone: isSv ? 'Telefon' : 'Phone',
    subtotal: isSv ? 'Delsumma' : 'Subtotal',
    shipping: isSv ? 'Frakt' : 'Shipping',
    freeShipping: isSv ? 'Fri frakt' : 'Free shipping',
    total: isSv ? 'Totalt' : 'Total',
    payNow: isSv ? 'KÖP NU' : 'BUY NOW',
    paySecurely: isSv ? 'Betala säkert' : 'Pay securely',
    backToCart: isSv ? 'Tillbaka' : 'Back',
    emptyCart: isSv ? 'Din kundvagn är tom' : 'Your cart is empty',
    goToShop: isSv ? 'Gå till butiken' : 'Go to shop',
    securePayment: isSv ? 'Säker betalning via Stripe' : 'Secure payment via Stripe',
    fastDelivery: isSv ? 'Snabb leverans (1–3 dagar)' : 'Fast delivery (1–3 days)',
    easyReturns: isSv ? 'Enkel retur inom 30 dagar' : 'Easy returns within 30 days',
    noHiddenFees: isSv ? 'Inga dolda avgifter' : 'No hidden fees',
    freeShippingOver: isSv
      ? `Fri frakt över ${shippingConfig.freeThreshold} kr`
      : `Free shipping over ${shippingConfig.freeThreshold} SEK`,
    addMoreForFree: isSv
      ? `Handla för ${Math.ceil(amountToFreeShipping)} kr till för fri frakt`
      : `Add ${Math.ceil(amountToFreeShipping)} SEK more for free shipping`,
    deliveryEstimate: isSv ? 'Leverans: 7–10 arbetsdagar' : 'Delivery: 7–10 business days',
    encrypted: isSv ? 'Din betalning är krypterad och säker' : 'Your payment is encrypted and secure',
    errorEmail: isSv ? 'Ange en giltig e-postadress' : 'Enter a valid email',
    errorName: isSv ? 'Ange för- och efternamn' : 'Enter first and last name',
    errorAddress: isSv ? 'Ange din gatuadress' : 'Enter your street address',
    errorZip: isSv ? 'Ange giltigt postnummer (t.ex. 123 45)' : 'Enter valid postal code',
    errorCity: isSv ? 'Ange stad' : 'Enter city',
    errorPhone: isSv ? 'Ange giltigt telefonnummer' : 'Enter valid phone number',
    checkoutFailed: isSv ? 'Betalningen kunde inte genomföras. Försök igen.' : 'Payment could not be processed. Please try again.',
    checkoutTimeout: isSv ? 'Checkout tog för lång tid. Försök igen.' : 'Checkout timed out. Please retry.',
    retry: isSv ? 'Försök igen' : 'Retry',
    qty: isSv ? 'Antal' : 'Qty',
    standardShipping: isSv ? 'Standardleverans (7–10 dagar)' : 'Standard delivery (7–10 days)',
  }), [isSv, shippingConfig.freeThreshold, amountToFreeShipping]);

  const formatPrice = (amount: number) =>
    new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', minimumFractionDigits: 0 }).format(amount);

  const validateField = useCallback((field: string, value: string): string | undefined => {
    const v = value.trim();
    switch (field) {
      case 'email': return (!v || !validateEmail(v) || v.length > 255) ? t.errorEmail : undefined;
      case 'name':
        if (!v || v.length < 2) return t.errorName;
        if (!/\s/.test(v)) return isSv ? 'Ange både för- och efternamn' : 'Enter both first and last name';
        return undefined;
      case 'address': return (!v || v.length < 3) ? t.errorAddress : undefined;
      case 'zip':
        if (!v) return t.errorZip;
        if (form.country === 'SE' && !validateSwedishZip(v)) return t.errorZip;
        return undefined;
      case 'city': return (!v || v.length < 2) ? t.errorCity : undefined;
      case 'phone': return (!v || !validatePhone(v)) ? t.errorPhone : undefined;
      default: return undefined;
    }
  }, [t, isSv, form.country]);

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
      if (city && !form.city) setForm(prev => ({ ...prev, city }));
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

    const requiredFields = ['email', 'name', 'address', 'zip', 'city', 'phone'] as const;
    const newErrors: FieldErrors = {};
    let hasErrors = false;
    for (const field of requiredFields) {
      const error = validateField(field, form[field]);
      if (error) { newErrors[field] = error; hasErrors = true; }
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
        const product = item?.product;
        const node = product?.node;
        const title = node?.title || item?.variantTitle || `Produkt ${idx + 1}`;
        const dbId = (product as any)?.dbId;
        const id = dbId || item?.variantId || `item_${idx}`;
        const price = Number.parseFloat(item?.price?.amount ?? '0');
        const image = node?.images?.edges?.[0]?.node?.url || '';
        return { id, title, price: Number.isFinite(price) && price > 0 ? price : 0, quantity: item?.quantity || 1, image };
      }).filter(i => i.price > 0);

      if (checkoutItems.length === 0) {
        throw new Error(isSv ? 'Inga giltiga produkter i kundvagnen' : 'No valid products in cart');
      }

      const addressParts = [form.address];
      if (form.apartment) addressParts.push(form.apartment);

      const checkoutBody = {
        items: checkoutItems,
        shipping: {
          name: form.name, address: addressParts.join(', '),
          careOf: form.careOf || '', company: form.company || '',
          zip: form.zip, city: form.city, country: form.country || 'SE', phone: form.phone || '',
        },
        email: form.email,
        language: cl,
      };

      setCheckoutStage('creating');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const res = await safeFetch('create-checkout', {
        body: checkoutBody,
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
      logActivity({ log_type: 'error', category: 'payment', message: 'Checkout failed', details: { error: message, email: form.email } });
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
        items: items.map(item => ({ title: item.product.node.title, price: parseFloat(item.price.amount), quantity: item.quantity })),
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
          <h1 className="text-xl font-semibold mb-3">{isSv ? 'Kassan är tillfälligt stängd' : 'Checkout is temporarily closed'}</h1>
          <p className="text-muted-foreground mb-6">{isSv ? 'Vi kan just nu inte ta emot beställningar.' : 'We cannot accept orders at this time.'}</p>
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
      {/* Minimal distraction-free header — logo + secure badge only */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background border-b border-border">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="font-display text-lg font-bold tracking-tight">
            4thepeople
          </Link>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="w-3.5 h-3.5 text-primary" />
            <span>{t.secureCheckout}</span>
          </div>
        </div>
      </header>

      <main className="pt-16 pb-36 lg:pb-20">
        <div className="max-w-2xl mx-auto px-4">

          {/* Shipping info banner — MOVED UP for instant clarity */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 mb-6 rounded-xl border border-border bg-secondary/30 p-3"
          >
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-primary" />
                {shippingCost === 0 ? t.freeShipping : t.deliveryEstimate}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-primary" />
                {t.noHiddenFees}
              </span>
              {shippingCost > 0 && amountToFreeShipping > 0 && (
                <span className="inline-flex items-center gap-1.5 text-primary font-medium">
                  {t.addMoreForFree}
                </span>
              )}
            </div>
          </motion.div>

          {/* Order summary — compact, always visible on top */}
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border rounded-2xl p-5 mb-6"
          >
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
              {t.orderSummary}
            </h2>
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.variantId} className="flex gap-3 items-center">
                  <div className="w-12 h-12 rounded-lg bg-secondary/50 overflow-hidden flex-shrink-0">
                    {item.product.node.images?.edges?.[0]?.node && (
                      <img src={item.product.node.images.edges[0].node.url} alt={item.product.node.title} className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.product.node.title}</p>
                    <p className="text-xs text-muted-foreground">{t.qty}: {item.quantity}</p>
                  </div>
                  <span className="text-sm font-semibold whitespace-nowrap">
                    {formatPrice(parseFloat(item.price.amount) * item.quantity)}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t border-border mt-4 pt-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t.subtotal}</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t.shipping}</span>
                <span className={shippingCost === 0 ? 'text-primary font-medium' : ''}>
                  {shippingCost === 0 ? t.freeShipping : formatPrice(shippingCost)}
                </span>
              </div>
              <div className="flex justify-between items-baseline pt-2 border-t border-border">
                <span className="font-bold">{t.total}</span>
                <span className="text-xl font-bold">{formatPrice(total)}</span>
              </div>
            </div>
          </motion.section>

          {/* Shipping form — single column, clean */}
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >
            <form id="checkout-form" onSubmit={handleSubmit} className="space-y-6">
              <div className="bg-card border border-border rounded-2xl p-5">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="email">{t.email} *</Label>
                    <Input id="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="off" required
                      value={form.email} onChange={(e) => updateField('email', e.target.value)} onBlur={() => handleBlur('email')}
                      placeholder="namn@example.com" className={touched.email && errors.email ? 'border-destructive' : ''} />
                    {renderFieldError('email')}
                  </div>

                  <div className="border-t border-border pt-4 space-y-4">
                    <div>
                      <Label htmlFor="name">{t.name} *</Label>
                      <Input id="name" autoComplete="name" autoCapitalize="words" required
                        value={form.name} onChange={(e) => updateField('name', e.target.value)} onBlur={() => handleBlur('name')}
                        className={touched.name && errors.name ? 'border-destructive' : ''} />
                      {renderFieldError('name')}
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

                    <div className="grid grid-cols-2 gap-3">
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
                      <Label htmlFor="phone">{t.phone} *</Label>
                      <Input id="phone" type="tel" inputMode="tel" autoComplete="tel"
                        value={form.phone} onChange={(e) => updateField('phone', e.target.value)} onBlur={() => handleBlur('phone')}
                        placeholder="070 123 45 67"
                        className={touched.phone && errors.phone ? 'border-destructive' : ''} />
                      {renderFieldError('phone')}
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
                  </div>

                  {/* Shipping method */}
                  <div className="border-t border-border pt-4">
                    <div className="flex items-center gap-3 p-3 rounded-xl border border-primary/30 bg-primary/5">
                      <Truck className="w-4 h-4 text-primary shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{t.standardShipping}</p>
                      </div>
                      <span className={`text-sm font-semibold ${shippingCost === 0 ? 'text-primary' : ''}`}>
                        {shippingCost === 0 ? t.freeShipping : formatPrice(shippingCost)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Trust badges — prominent, right before CTA */}
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: Shield, text: t.securePayment },
                    { icon: Truck, text: t.fastDelivery },
                    { icon: RotateCcw, text: t.easyReturns },
                    { icon: Check, text: t.noHiddenFees },
                  ].map((badge, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <badge.icon className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span>{badge.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payment methods display */}
              <PaymentMethods />

              {/* Checkout error */}
              {checkoutError && (
                <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 space-y-2">
                  <p className="text-xs text-destructive">{checkoutError}</p>
                  <Button type="button" variant="outline" size="sm" onClick={handleSubmit}>{t.retry}</Button>
                </div>
              )}

              {/* Desktop CTA */}
              <div className="hidden lg:block">
                <Button type="submit" size="lg" className="w-full h-14 text-base font-bold uppercase tracking-wide" disabled={isCheckingOut}>
                  {isCheckingOut ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{stageText[checkoutStage as keyof typeof stageText] || stageText.connecting}</>
                  ) : (
                    <><Lock className="w-4 h-4 mr-2" />{t.payNow} — {formatPrice(total)}</>
                  )}
                </Button>
                <p className="text-center text-[11px] text-muted-foreground mt-2">{t.encrypted}</p>
              </div>
            </form>
          </motion.section>

          {/* Back link */}
          <div className="mt-6 text-center">
            <Link to="/produkter" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" />
              {t.backToCart}
            </Link>
          </div>
        </div>
      </main>

      {/* Sticky mobile CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-background border-t border-border px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {checkoutError && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-2 mb-2">
            <p className="text-[11px] text-destructive">{checkoutError}</p>
          </div>
        )}
        <Button type="button" size="lg" className="w-full h-12 text-sm font-bold uppercase tracking-wide" onClick={handleSubmit} disabled={isCheckingOut}>
          {isCheckingOut ? (
            <><Loader2 className="w-3.5 h-3.5 mr-1.5 shrink-0 animate-spin" /><span className="truncate">{stageText[checkoutStage as keyof typeof stageText] || stageText.connecting}</span></>
          ) : (
            <><Lock className="w-3.5 h-3.5 mr-1.5 shrink-0" /><span>{t.payNow}</span><span className="ml-1.5">{formatPrice(total)}</span></>
          )}
        </Button>
        <p className="text-center text-[10px] text-muted-foreground mt-1.5">{t.encrypted}</p>
      </div>
    </div>
  );
};

export default Checkout;
