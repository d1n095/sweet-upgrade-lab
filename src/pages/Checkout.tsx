import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ShoppingBag, Truck, Shield, Loader2, CreditCard, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { useCartStore } from '@/stores/cartStore';
import { useLanguage, getContentLang } from '@/context/LanguageContext';
import { storeConfig } from '@/config/storeConfig';
import PaymentMethods from '@/components/trust/PaymentMethods';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useStoreSettings } from '@/stores/storeSettingsStore';

const Checkout = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const cl = getContentLang(language);
  const { items, clearCart } = useCartStore();
  const { checkoutEnabled } = useStoreSettings();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    email: '',
    name: '',
    address: '',
    zip: '',
    city: '',
    country: 'SE',
    phone: '',
  });

  const subtotal = items.reduce((sum, item) => sum + (parseFloat(item.price.amount) * item.quantity), 0);
  const shippingCost = subtotal >= storeConfig.shipping.freeShippingThreshold ? 0 : storeConfig.shipping.cost;
  const total = subtotal + shippingCost;

  const content = {
    sv: {
      title: 'Kassa',
      orderSummary: 'Din beställning',
      shippingInfo: 'Leveransinformation',
      email: 'E-post',
      name: 'Fullständigt namn',
      address: 'Adress',
      zip: 'Postnummer',
      city: 'Stad',
      phone: 'Telefon (valfritt)',
      subtotal: 'Delsumma',
      shipping: 'Frakt',
      freeShipping: 'Fri frakt',
      total: 'Totalt',
      pay: 'Betala',
      paySecurely: 'Betala säkert',
      processing: 'Bearbetar...',
      backToCart: 'Tillbaka',
      emptyCart: 'Din kundvagn är tom',
      goToShop: 'Gå till butiken',
      secureCheckout: 'Säker betalning',
      deliveryTime: storeConfig.shipping.deliveryTime.sv,
      fillAllFields: 'Fyll i alla obligatoriska fält',
    },
    en: {
      title: 'Checkout',
      orderSummary: 'Your order',
      shippingInfo: 'Shipping information',
      email: 'Email',
      name: 'Full name',
      address: 'Address',
      zip: 'Postal code',
      city: 'City',
      phone: 'Phone (optional)',
      subtotal: 'Subtotal',
      shipping: 'Shipping',
      freeShipping: 'Free shipping',
      total: 'Total',
      pay: 'Pay',
      paySecurely: 'Pay securely',
      processing: 'Processing...',
      backToCart: 'Back',
      emptyCart: 'Your cart is empty',
      goToShop: 'Go to shop',
      secureCheckout: 'Secure checkout',
      deliveryTime: storeConfig.shipping.deliveryTime.en,
      fillAllFields: 'Please fill in all required fields',
    },
  };

  const t = content[cl as keyof typeof content] || content.en;

  const formatPrice = (amount: number) =>
    new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', minimumFractionDigits: 0 }).format(amount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.email || !form.name || !form.address || !form.zip || !form.city) {
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
        // Redirect to Stripe Checkout
        clearCart();
        window.location.href = data.url;
      }
    } catch (err: any) {
      console.error('Checkout error:', err);
      toast.error(cl === 'sv' ? 'Något gick fel. Försök igen.' : 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-24 pb-20">
          <div className="container mx-auto px-4 max-w-lg text-center py-20">
            <ShoppingBag className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-4">{t.emptyCart}</h1>
            <Button onClick={() => navigate('/shop')}>{t.goToShop}</Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-24 pb-20">
        <div className="container mx-auto px-4 max-w-5xl">
          {/* Back button */}
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            {t.backToCart}
          </button>

          <h1 className="font-display text-3xl font-bold mb-8">{t.title}</h1>

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
                        required
                        value={form.email}
                        onChange={(e) => updateField('email', e.target.value)}
                        placeholder="namn@example.com"
                      />
                    </div>

                    <div>
                      <Label htmlFor="name">{t.name} *</Label>
                      <Input
                        id="name"
                        required
                        value={form.name}
                        onChange={(e) => updateField('name', e.target.value)}
                      />
                    </div>

                    <div>
                      <Label htmlFor="address">{t.address} *</Label>
                      <Input
                        id="address"
                        required
                        value={form.address}
                        onChange={(e) => updateField('address', e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="zip">{t.zip} *</Label>
                        <Input
                          id="zip"
                          required
                          value={form.zip}
                          onChange={(e) => updateField('zip', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="city">{t.city} *</Label>
                        <Input
                          id="city"
                          required
                          value={form.city}
                          onChange={(e) => updateField('city', e.target.value)}
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="phone">{t.phone}</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={form.phone}
                        onChange={(e) => updateField('phone', e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Pay button */}
                <Button
                  type="submit"
                  size="lg"
                  className="w-full h-14 text-base font-semibold"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <><Loader2 className="w-5 h-5 animate-spin mr-2" />{t.processing}</>
                  ) : (
                    <><CreditCard className="w-5 h-5 mr-2" />{t.paySecurely} — {formatPrice(total)}</>
                  )}
                </Button>

                {/* Trust */}
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Shield className="w-3.5 h-3.5" />
                  {t.secureCheckout}
                </div>

                <PaymentMethods />
              </form>
            </motion.div>

            {/* Right: Order summary */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="lg:col-span-2"
            >
              <div className="bg-card border border-border rounded-2xl p-6 sticky top-28">
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
                        <p className="text-xs text-muted-foreground">{cl === 'sv' ? 'Antal' : 'Qty'}: {item.quantity}</p>
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
                  <div className="flex justify-between text-lg font-bold pt-2 border-t border-border">
                    <span>{t.total}</span>
                    <span className="text-primary">{formatPrice(total)}</span>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground mt-4 text-center">
                  {t.deliveryTime}
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Checkout;
