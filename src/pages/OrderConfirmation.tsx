import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Package, Clock, Mail, ArrowRight, Truck, Loader2, Sparkles, ShoppingBag, Lightbulb } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Link, useSearchParams } from 'react-router-dom';
import { storeConfig } from '@/config/storeConfig';
import { supabase } from '@/integrations/supabase/client';
import { tracedInvoke } from '@/lib/tracedInvoke';
import { useCartStore } from '@/stores/cartStore';
import { getOrderDisplayId } from '@/utils/orderDisplay';
import { trackCheckoutComplete } from '@/utils/analyticsTracker';

interface RecommendedProduct {
  id: string;
  title_sv: string;
  handle: string | null;
  price: number;
  image_urls: string[] | null;
}

const OrderConfirmation = () => {
  const { language } = useLanguage();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id') || '';
  const [orderRef, setOrderRef] = useState('');
  const [orderId, setOrderId] = useState('');
  const [paymentIntentId, setPaymentIntentId] = useState('');
  const [orderEmail, setOrderEmail] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [recommended, setRecommended] = useState<RecommendedProduct[]>([]);
  const maxRetries = 10;
  const retryDelayMs = 1500;
  const activeSessionRef = useRef('');

  const clearCart = useCartStore((s) => s.clearCart);
  useEffect(() => { clearCart(); }, [clearCart]);

  useEffect(() => {
    activeSessionRef.current = sessionId;
    setOrderRef('');
    setOrderId('');
    setPaymentIntentId('');
    setOrderEmail('');
    setIsLoading(Boolean(sessionId));
  }, [sessionId]);

  useEffect(() => {
    let isCancelled = false;

    const pollOrderBySession = async () => {
      if (!sessionId) { setIsLoading(false); return; }

      for (let attempt = 0; attempt < maxRetries && !isCancelled; attempt += 1) {
        try {
          const { data: fnData, error: fnError } = await tracedInvoke('lookup-order', {
            body: { session_id: sessionId },
          });

          if (isCancelled || activeSessionRef.current !== sessionId) return;

          if (!fnError && fnData?.found && fnData.order?.stripe_session_id === sessionId) {
            const order = fnData.order;
            setOrderId(order.id);
            setPaymentIntentId(order.payment_intent_id || '');
            setOrderRef(getOrderDisplayId({
              payment_intent_id: order.payment_intent_id,
              stripe_session_id: order.stripe_session_id,
              id: order.id,
            }));
            if (order.order_email) setOrderEmail(order.order_email);
            // Track purchase completion for analytics funnel
            trackCheckoutComplete(order.id, order.total_amount || 0);
            setIsLoading(false);
            return;
          }
        } catch (err) {
          console.error('[order-confirmation] lookup failed:', err);
        }

        if (attempt < maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        }
      }

      if (!isCancelled && activeSessionRef.current === sessionId) {
        setIsLoading(false);
      }
    };

    void pollOrderBySession();
    return () => { isCancelled = true; };
  }, [sessionId, maxRetries, retryDelayMs]);

  // Load recommended products for soft upsell
  useEffect(() => {
    const loadRecommended = async () => {
      const { data } = await supabase
        .from('products')
        .select('id, title_sv, handle, price, image_urls')
        .eq('is_visible', true)
        .eq('status', 'active')
        .order('units_sold_30d', { ascending: false })
        .limit(3);
      setRecommended((data || []) as RecommendedProduct[]);
    };
    loadRecommended();
  }, []);

  const isSv = language === 'sv';

  const t = {
    badge: isSv ? 'Tack för din beställning!' : 'Thank you for your order!',
    title: isSv ? 'Din order är mottagen' : 'Your order is confirmed',
    subtitle: isSv ? 'Vi har tagit emot din beställning och påbörjar behandlingen inom kort.' : 'We have received your order and will begin processing it shortly.',
    orderNumberLabel: isSv ? 'Order-ID' : 'Order ID',
    waitingTitle: isSv ? 'Väntar på betalningsbekräftelse...' : 'Waiting for payment confirmation...',
    waitingDesc: isSv ? 'Din betalning behandlas. Ordernumret visas automatiskt inom några sekunder.' : 'Your payment is being processed. The order number will appear automatically in a few seconds.',
    steps: [
      { icon: CheckCircle, title: isSv ? 'Order mottagen' : 'Order received', description: isSv ? 'Vi har tagit emot din beställning och skickat en bekräftelse till din e-post.' : 'We have received your order and sent a confirmation to your email.' },
      { icon: Package, title: isSv ? 'Vi behandlar din order' : 'We process your order', description: isSv ? 'Vi granskar din beställning manuellt för att säkerställa kvalitet.' : 'We manually review your order to ensure quality.' },
      { icon: Truck, title: isSv ? 'Leverans' : 'Shipping', description: isSv ? 'Produkten skickas inom 1–3 arbetsdagar.' : 'Product ships within 1–3 business days.' },
      { icon: Mail, title: isSv ? 'Spårningsinformation' : 'Tracking info', description: isSv ? 'Du får ett mail med spårningslänk när paketet skickats.' : "You'll receive tracking info via email when shipped." },
    ],
    deliveryTime: isSv ? `Beräknad leveranstid: ${storeConfig.shipping.deliveryDays} arbetsdagar` : `Estimated delivery: ${storeConfig.shipping.deliveryDays} business days`,
    emailInfo: isSv ? 'Orderbekräftelse skickas till din e-post.' : 'Order confirmation sent to your email.',
    trackOrder: isSv ? 'Spåra din order' : 'Track your order',
    continueShopping: isSv ? 'Fortsätt handla' : 'Continue shopping',
    questions: isSv ? 'Har du frågor?' : 'Have questions?',
    contactUs: isSv ? 'Kontakta oss på' : 'Contact us at',
    tipsTitle: isSv ? 'Tips för bästa resultat' : 'Tips for best results',
    tips: isSv
      ? ['Förvara svalt och torrt', 'Läs instruktionerna på förpackningen', 'Kontakta oss om du har frågor']
      : ['Store in a cool, dry place', 'Read the instructions on the packaging', 'Contact us if you have questions'],
    youMayAlsoLike: isSv ? 'Populära produkter' : 'Popular products',
  };

  const trackHref = paymentIntentId
    ? `/track-order?q=${encodeURIComponent(paymentIntentId)}`
    : orderId
      ? `/track-order?q=${encodeURIComponent(orderId)}`
      : '/track-order';

  const formatPrice = (amount: number) =>
    new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', minimumFractionDigits: 0 }).format(amount);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-24 pb-20">
        <div className="container mx-auto px-4 max-w-3xl">
          {/* Success Header */}
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center mb-12">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: 'spring' }} className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-primary" />
            </motion.div>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
              {t.badge}
            </span>
            <h1 className="font-display text-4xl md:text-5xl font-semibold mb-4">{t.title}</h1>
            <p className="text-muted-foreground text-lg mb-6">{t.subtitle}</p>

            {orderRef ? (
              <div className="inline-block bg-card border border-border/50 rounded-xl px-6 py-3">
                <p className="text-sm text-muted-foreground">{t.orderNumberLabel}</p>
                <p className="font-mono text-xl font-semibold">{orderRef}</p>
              </div>
            ) : isLoading ? (
              <div className="inline-flex flex-col items-center gap-2 bg-card border border-border/50 rounded-xl px-6 py-4">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <p className="text-sm font-medium">{t.waitingTitle}</p>
                <p className="text-xs text-muted-foreground">{t.waitingDesc}</p>
              </div>
            ) : null}
          </motion.div>

          {/* What happens next */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-card border border-border/50 rounded-2xl p-6 md:p-8 mb-8">
            <h2 className="font-display text-xl font-semibold mb-6 text-center">
              {isSv ? 'Vad händer nu?' : 'What happens next?'}
            </h2>
            <div className="space-y-6">
              {t.steps.map((step, index) => (
                <motion.div key={index} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + index * 0.1 }} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <step.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium">{step.title}</h3>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Usage tips */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="bg-secondary/30 border border-border/50 rounded-2xl p-6 mb-8">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-accent" />
              {t.tipsTitle}
            </h3>
            <ul className="space-y-2">
              {t.tips.map((tip, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="text-accent mt-0.5">✓</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Delivery Time */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="bg-primary/5 rounded-2xl p-6 text-center mb-8">
            <Clock className="w-8 h-8 text-primary mx-auto mb-3" />
            <p className="font-medium text-lg">{t.deliveryTime}</p>
            <p className="text-sm text-muted-foreground mt-2">{t.emailInfo}</p>
            {orderEmail && (
              <p className="text-xs text-muted-foreground mt-1">
                {isSv ? 'E-post:' : 'Email:'} {orderEmail}
              </p>
            )}
          </motion.div>

          {/* Soft upsell — popular products */}
          {recommended.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }} className="mb-8">
              <h3 className="font-display text-lg font-semibold mb-4 text-center flex items-center justify-center gap-2">
                <Sparkles className="w-4 h-4 text-accent" />
                {t.youMayAlsoLike}
              </h3>
              <div className="grid grid-cols-3 gap-3">
                {recommended.map(product => (
                  <Link
                    key={product.id}
                    to={`/product/${product.handle || product.id}`}
                    className="bg-card border border-border/50 rounded-xl p-3 hover:shadow-md transition-shadow group"
                  >
                    <div className="aspect-square rounded-lg bg-secondary/30 overflow-hidden mb-2">
                      {product.image_urls?.[0] ? (
                        <img src={product.image_urls[0]} alt={product.title_sv} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ShoppingBag className="w-6 h-6 text-muted-foreground/30" />
                        </div>
                      )}
                    </div>
                    <p className="text-sm font-medium truncate">{product.title_sv}</p>
                    <p className="text-xs text-muted-foreground">{formatPrice(product.price)}</p>
                  </Link>
                ))}
              </div>
            </motion.div>
          )}

          {/* Actions */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }} className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild>
              <Link to={trackHref} className="flex items-center gap-2">
                {t.trackOrder}
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/produkter">{t.continueShopping}</Link>
            </Button>
          </motion.div>

          {/* Contact Info */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="text-center mt-12 text-sm text-muted-foreground">
            <p>
              {t.questions}{' '}
              <a href={`mailto:${storeConfig.contact.email}`} className="text-primary hover:underline">
                {t.contactUs} {storeConfig.contact.email}
              </a>
            </p>
          </motion.div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default OrderConfirmation;
