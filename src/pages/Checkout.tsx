import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ShoppingBag, Truck, Shield, Loader2, CreditCard, AlertTriangle, Lock, RotateCcw, Package, Clock } from 'lucide-react';
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

interface FieldErrors {
  email?: string;
  name?: string;
  address?: string;
  zip?: string;
  city?: string;
}

const Checkout = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const cl = getContentLang(language);
  const { items, clearCart } = useCartStore();
  const { checkoutEnabled } = useStoreSettings();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
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

  // Auto-fill from logged-in user's profile
  useEffect(() => {
    if (profileLoaded || !user) return;
    
    const loadProfileData = async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('full_name, phone, address, zip, city, country')
          .eq('user_id', user.id)
          .maybeSingle();

        setForm(prev => ({
          ...prev,
          email: user.email || prev.email,
          name: data?.full_name || prev.name,
          phone: data?.phone || prev.phone,
          address: data?.address || prev.address,
          zip: data?.zip || prev.zip,
          city: data?.city || prev.city,
          country: data?.country || prev.country,
        }));
      } catch (err) {
        // Just use email as fallback
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
  const shippingCost = subtotal >= storeConfig.shipping.freeShippingThreshold ? 0 : storeConfig.shipping.cost;
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
    errorEmail: isSv ? 'Ange en giltig e-postadress' : 'Enter a valid email address',
    errorName: isSv ? 'Ange ditt namn' : 'Enter your name',
    errorAddress: isSv ? 'Ange din adress' : 'Enter your address',
    errorZip: isSv ? 'Ange postnummer' : 'Enter postal code',
    errorCity: isSv ? 'Ange stad' : 'Enter city',
    checkoutFailed: isSv ? 'Betalningen kunde inte genomföras. Försök igen.' : 'Payment could not be processed. Please try again.',
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

    // Auto-fill city from zip
    if (field === 'zip' && value.length >= 2) {
      const prefix = value.substring(0, 2);
      const city = ZIP_CITY_MAP[prefix];
      if (city && !form.city) {
        setForm(prev => ({ ...prev, city }));
      }
    }

    // Live validation if already touched
    if (touched[field]) {
      const error = validateField(field, value);
      setErrors(prev => ({ ...prev, [field]: error }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return; // Prevent double submit

    // Validate all fields
    const requiredFields = ['email', 'name', 'address', 'zip', 'city'] as const;
    const newErrors: FieldErrors = {};
    let hasError = false;
    for (const field of requiredFields) {
      const error = validateField(field, form[field]);
      if (error) {
        newErrors[field] = error;
        hasError = true;
      }
    }
    setErrors(newErrors);
    setTouched({ email: true, name: true, address: true, zip: true, city: true });

    if (hasError) {
      toast.error(t.fillAllFields);
      return;
    }

    setIsSubmitting(true);

    try {
      const checkoutItems = items.map(item => ({
        id: (item.product as any).dbId || item.variantId,
        title: item.product.node.title,
        price: parseFloat(item.price.amount),
        quantity: item.quantity,
        image: item.product.node.images?.edges?.[0]?.node?.url || '',
      }));

      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: {
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
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.url) {
        completedRef.current = true;
        trackCheckoutStep('payment_redirect', { total });
        
        // Save shipping info to profile for future auto-fill
        if (user) {
          supabase.from('profiles').update({
            full_name: form.name,
            phone: form.phone || null,
            address: form.address,
            zip: form.zip,
            city: form.city,
            country: form.country,
          }).eq('user_id', user.id).then(() => {});
        }
        
        clearCart();
        window.location.href = data.url;
      }
    } catch (err: any) {
      console.error('Checkout error:', err);
      logActivity({
        log_type: 'error',
        category: 'payment',
        message: 'Checkout failed',
        details: { error: err.message, email: form.email },
      });
      toast.error(t.checkoutFailed);
    } finally {
      setIsSubmitting(false);
    }
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
  const completedRef = useRef(false);
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
          <Button onClick={() => navigate('/produkter')}>
            {isSv ? 'Tillbaka till produkter' : 'Back to products'}
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
          <Button onClick={() => navigate('/produkter')}>{t.goToShop}</Button>
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
      {/* Minimal checkout header — distraction-free */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between max-w-5xl">
          <button
            onClick={() => {
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                navigate('/produkter');
              }
            }}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {t.backToCart}
          </button>
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
              <form onSubmit={handleSubmit} className="space-y-6">
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

                {/* Desktop pay button */}
                <div className="hidden lg:block mt-5 space-y-3">
                  <Button
                    type="submit"
                    form="checkout-form"
                    size="lg"
                    className="w-full h-14 text-base font-semibold"
                    disabled={isSubmitting}
                    onClick={handleSubmit}
                  >
                    {isSubmitting ? (
                      <><Loader2 className="w-5 h-5 animate-spin mr-2" />{t.processing}</>
                    ) : (
                      <><Lock className="w-4 h-4 mr-2" />{t.paySecurely} — {formatPrice(total)}</>
                    )}
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
    </div>
  );
};

export default Checkout;
