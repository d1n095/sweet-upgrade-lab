import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Package, Clock, Mail, ArrowRight, Truck, Loader2 } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Link, useSearchParams } from 'react-router-dom';
import { storeConfig } from '@/config/storeConfig';
import { supabase } from '@/integrations/supabase/client';
import { useCartStore } from '@/stores/cartStore';
import { toast } from 'sonner';

const OrderConfirmation = () => {
  const { language } = useLanguage();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id') || '';
  const [orderNumber, setOrderNumber] = useState('');
  const [orderId, setOrderId] = useState('');
  const [orderEmail, setOrderEmail] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 5;
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCart = useCartStore((s) => s.clearCart);
  useEffect(() => {
    clearCart();
  }, [clearCart]);

  useEffect(() => {
    let isActive = true;

    const resolveOrder = async () => {
      if (!sessionId) {
        setIsLoading(false);
        return;
      }

      // If we already have the order number, we're done
      if (orderNumber) {
        setIsLoading(false);
        return;
      }

      try {
        // Call ensure_order — this creates the order from the Stripe session if it doesn't exist
        const { data, error } = await supabase.functions.invoke('stripe-webhook', {
          body: {
            action: 'ensure_order',
            session_id: sessionId,
          },
        });

        if (!isActive) return;

        if (!error && data?.order) {
          if (data.order.id) setOrderId(data.order.id);
          if (data.order.order_number) setOrderNumber(data.order.order_number);
          if (data.order.order_email) setOrderEmail(data.order.order_email);
          setIsLoading(false);
          return;
        }

        // If payment not completed yet (e.g. Klarna async), retry
        if (data?.error === 'payment_not_completed' && retryCount < maxRetries) {
          console.log(`[order-confirmation] Payment not yet confirmed, retry ${retryCount + 1}/${maxRetries}...`);
          retryTimerRef.current = setTimeout(() => {
            if (isActive) setRetryCount((c) => c + 1);
          }, 3000);
          return;
        }
      } catch (err) {
        console.error('[order-confirmation] Failed to ensure order:', err);
      }

      // Fallback: try direct DB lookup
      if (!isActive) return;
      try {
        const { data } = await supabase
          .from('orders')
          .select('id, order_number, order_email')
          .eq('stripe_session_id', sessionId)
          .maybeSingle();

        if (!isActive) return;
        if (data?.id) setOrderId(data.id);
        if (data?.order_number) setOrderNumber(data.order_number);
        if (data?.order_email) setOrderEmail(data.order_email);
      } catch {}

      setIsLoading(false);
    };

    resolveOrder();

    return () => {
      isActive = false;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [sessionId, retryCount]);

  const copySessionId = () => {
    navigator.clipboard.writeText(sessionId);
    toast.success(language === 'sv' ? 'Kopierat!' : 'Copied!');
  };

  const content = {
    sv: {
      badge: 'Tack för din beställning!',
      title: 'Din order är mottagen',
      subtitle: 'Vi har tagit emot din beställning och påbörjar behandlingen inom kort.',
      orderNumberLabel: 'Ordernummer',
      referenceLabel: 'Betalningsreferens',
      waitingTitle: 'Väntar på betalningsbekräftelse...',
      waitingDesc: 'Din betalning behandlas. Ordernumret visas automatiskt inom några sekunder.',
      steps: [
        { icon: CheckCircle, title: 'Order mottagen', description: 'Vi har tagit emot din beställning och skickat en bekräftelse till din e-post.' },
        { icon: Package, title: 'Vi behandlar din order', description: 'Vi granskar din beställning manuellt för att säkerställa kvalitet innan leverans.' },
        { icon: Truck, title: 'Leverans från leverantör', description: `Produkten skickas direkt från vår EU-baserade leverantör inom 1-3 arbetsdagar.` },
        { icon: Mail, title: 'Du får spårningsinformation', description: 'När paketet har skickats får du ett mail med spårningslänk.' },
      ],
      deliveryTime: `Beräknad leveranstid: ${storeConfig.shipping.deliveryDays} arbetsdagar`,
      emailInfo: 'Orderbekräftelse skickas till din e-post när betalningen är bekräftad.',
      trackOrder: 'Spåra din order',
      continueShopping: 'Fortsätt handla',
      questions: 'Har du frågor?',
      contactUs: 'Kontakta oss på',
    },
    en: {
      badge: 'Thank you for your order!',
      title: 'Your order is confirmed',
      subtitle: 'We have received your order and will begin processing it shortly.',
      orderNumberLabel: 'Order number',
      referenceLabel: 'Payment reference',
      waitingTitle: 'Waiting for payment confirmation...',
      waitingDesc: 'Your payment is being processed. The order number will appear automatically in a few seconds.',
      steps: [
        { icon: CheckCircle, title: 'Order received', description: 'We have received your order and sent a confirmation to your email.' },
        { icon: Package, title: 'We process your order', description: 'We manually review your order to ensure quality before shipping.' },
        { icon: Truck, title: 'Shipped from supplier', description: `The product ships directly from our EU-based supplier within 1-3 business days.` },
        { icon: Mail, title: 'You receive tracking info', description: "When the package has been shipped, you'll receive an email with tracking." },
      ],
      deliveryTime: `Estimated delivery: ${storeConfig.shipping.deliveryDays} business days`,
      emailInfo: 'Order confirmation is sent to your email after payment is confirmed.',
      trackOrder: 'Track your order',
      continueShopping: 'Continue shopping',
      questions: 'Have questions?',
      contactUs: 'Contact us at',
    },
  };

  const t = content[language as keyof typeof content] || content.en;

  // Track link uses ONLY DB-sourced order data
  const trackHref = orderNumber
    ? `/track-order?q=${encodeURIComponent(orderNumber)}`
    : orderId
      ? `/order/${orderId}`
      : '/track-order';

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

            {/* Order number or loading state */}
            {orderNumber ? (
              <div className="inline-block bg-card border border-border/50 rounded-xl px-6 py-3">
                <p className="text-sm text-muted-foreground">{t.orderNumberLabel}</p>
                <p className="font-mono text-xl font-semibold">{orderNumber}</p>
              </div>
            ) : isLoading ? (
              <div className="inline-flex flex-col items-center gap-2 bg-card border border-border/50 rounded-xl px-6 py-4">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <p className="text-sm font-medium">{t.waitingTitle}</p>
                <p className="text-xs text-muted-foreground">{t.waitingDesc}</p>
              </div>
            ) : null}
          </motion.div>

          {/* Process Steps */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-card border border-border/50 rounded-2xl p-6 md:p-8 mb-8">
            <h2 className="font-display text-xl font-semibold mb-6 text-center">
              {language === 'sv' ? 'Vad händer nu?' : 'What happens next?'}
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

          {/* Delivery Time */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="bg-primary/5 rounded-2xl p-6 text-center mb-8">
            <Clock className="w-8 h-8 text-primary mx-auto mb-3" />
            <p className="font-medium text-lg">{t.deliveryTime}</p>
            <p className="text-sm text-muted-foreground mt-2">{t.emailInfo}</p>
            {orderEmail ? (
              <p className="text-xs text-muted-foreground mt-1">
                {language === 'sv' ? 'E-post:' : 'Email:'} {orderEmail}
              </p>
            ) : null}
          </motion.div>

          {/* Actions */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }} className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild>
              <Link
                to={trackHref}
                className="flex items-center gap-2"
              >
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
