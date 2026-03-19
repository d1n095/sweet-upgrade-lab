import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Package, Truck, MapPin, CheckCircle2, Clock, Loader2,
  ArrowLeft, CreditCard, Mail, Calendar, Hash, ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/context/LanguageContext';

const statusConfig: Record<string, { icon: React.ElementType; color: string; step: number }> = {
  pending: { icon: Clock, color: 'text-yellow-600', step: 1 },
  confirmed: { icon: CheckCircle2, color: 'text-blue-600', step: 2 },
  processing: { icon: Package, color: 'text-primary', step: 3 },
  shipped: { icon: Truck, color: 'text-primary', step: 4 },
  in_transit: { icon: MapPin, color: 'text-primary', step: 5 },
  delivered: { icon: CheckCircle2, color: 'text-success', step: 6 },
};

const OrderDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { language } = useLanguage();
  const { user } = useAuth();
  const [order, setOrder] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const t = language === 'sv' ? {
    back: 'Tillbaka till ordrar',
    orderDetail: 'Orderdetaljer',
    orderNumber: 'Ordernummer',
    date: 'Datum',
    email: 'E-post',
    paymentMethod: 'Betalmetod',
    paymentStatus: 'Betalstatus',
    total: 'Totalt',
    items: 'Produkter',
    shippingAddress: 'Leveransadress',
    trackOrder: 'Spåra order',
    notFound: 'Order hittades inte',
    notFoundDesc: 'Vi kunde inte hitta den här ordern.',
    statuses: {
      pending: 'Order mottagen', confirmed: 'Bekräftad', processing: 'Packas',
      shipped: 'Skickad', in_transit: 'På väg', delivered: 'Levererad',
    },
    paymentStatuses: { paid: 'Betald', unpaid: 'Obetald', failed: 'Misslyckad' },
    trackingNumber: 'Spårningsnummer',
    estimatedDelivery: 'Beräknad leverans',
  } : {
    back: 'Back to orders',
    orderDetail: 'Order Details',
    orderNumber: 'Order number',
    date: 'Date',
    email: 'Email',
    paymentMethod: 'Payment method',
    paymentStatus: 'Payment status',
    total: 'Total',
    items: 'Products',
    shippingAddress: 'Shipping address',
    trackOrder: 'Track order',
    notFound: 'Order not found',
    notFoundDesc: 'We could not find this order.',
    statuses: {
      pending: 'Received', confirmed: 'Confirmed', processing: 'Processing',
      shipped: 'Shipped', in_transit: 'In transit', delivered: 'Delivered',
    },
    paymentStatuses: { paid: 'Paid', unpaid: 'Unpaid', failed: 'Failed' },
    trackingNumber: 'Tracking number',
    estimatedDelivery: 'Estimated delivery',
  };

  useEffect(() => {
    if (!id || !user) return;
    const load = async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .maybeSingle();
      if (error || !data) setNotFound(true);
      else setOrder(data);
      setIsLoading(false);
    };
    load();
  }, [id, user]);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString(language === 'sv' ? 'sv-SE' : 'en-US', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });

  const formatPrice = (amount: number, currency: string) =>
    new Intl.NumberFormat('sv-SE', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
        <Footer />
      </div>
    );
  }

  if (notFound || !order) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="max-w-2xl mx-auto px-4 py-24 text-center">
          <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h1 className="text-2xl font-bold mb-2">{t.notFound}</h1>
          <p className="text-muted-foreground mb-6">{t.notFoundDesc}</p>
          <Link to="/profile?tab=orders">
            <Button><ArrowLeft className="w-4 h-4 mr-2" />{t.back}</Button>
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const currentStep = statusConfig[order.status]?.step || 1;
  const StatusIcon = statusConfig[order.status]?.icon || Clock;
  const statusColor = statusConfig[order.status]?.color || 'text-muted-foreground';
  const items = Array.isArray(order.items) ? order.items : [];
  const shipping = order.shipping_address && typeof order.shipping_address === 'object' ? order.shipping_address as any : null;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Back link */}
        <Link to="/profile?tab=orders" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          {t.back}
        </Link>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-2xl p-6 mb-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold">{order.order_number || order.id.slice(0, 8)}</h1>
              <p className="text-sm text-muted-foreground mt-1">{formatDate(order.created_at)}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-primary">{formatPrice(order.total_amount, order.currency)}</p>
              <Badge className={`${statusColor} bg-transparent border mt-1`}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {t.statuses[order.status as keyof typeof t.statuses] || order.status}
              </Badge>
            </div>
          </div>

          {/* Progress */}
          <div className="mt-6 relative">
            <div className="absolute top-4 left-4 right-4 h-0.5 bg-border">
              <motion.div className="h-full bg-primary" initial={{ width: 0 }} animate={{ width: `${((currentStep - 1) / 5) * 100}%` }} transition={{ duration: 0.5 }} />
            </div>
            <div className="flex justify-between relative">
              {Object.entries(statusConfig).map(([status, config]) => {
                const isCompleted = config.step <= currentStep;
                const isCurrent = config.step === currentStep;
                const Icon = config.icon;
                return (
                  <div key={status} className="flex flex-col items-center">
                    <motion.div
                      className={`w-8 h-8 rounded-full flex items-center justify-center z-10 transition-colors ${isCompleted ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'} ${isCurrent ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                      animate={{ scale: isCurrent ? 1.1 : 1 }}
                    >
                      <Icon className="w-4 h-4" />
                    </motion.div>
                    <span className={`text-xs mt-2 text-center max-w-[60px] ${isCompleted ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                      {t.statuses[status as keyof typeof t.statuses]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>

        {/* Info grid */}
        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card border border-border rounded-xl p-4 space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2"><CreditCard className="w-4 h-4 text-primary" />{t.paymentStatus}</h3>
            <Badge variant={order.payment_status === 'paid' ? 'default' : 'destructive'}>
              {t.paymentStatuses[order.payment_status as keyof typeof t.paymentStatuses] || order.payment_status}
            </Badge>
            {order.payment_method && (
              <p className="text-sm text-muted-foreground capitalize">{order.payment_method}</p>
            )}
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-card border border-border rounded-xl p-4 space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2"><Mail className="w-4 h-4 text-primary" />{t.email}</h3>
            <p className="text-sm">{order.order_email}</p>
            {order.tracking_number && (
              <div>
                <p className="text-xs text-muted-foreground">{t.trackingNumber}</p>
                <p className="text-sm font-mono">{order.tracking_number}</p>
              </div>
            )}
            {order.estimated_delivery && (
              <div>
                <p className="text-xs text-muted-foreground">{t.estimatedDelivery}</p>
                <p className="text-sm">{new Date(order.estimated_delivery).toLocaleDateString(language === 'sv' ? 'sv-SE' : 'en-US')}</p>
              </div>
            )}
          </motion.div>
        </div>

        {/* Items */}
        {items.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-card border border-border rounded-xl p-4 mb-6">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Package className="w-4 h-4 text-primary" />{t.items}</h3>
            <div className="space-y-3">
              {items.map((item: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <div className="flex items-center gap-3">
                    {item.image && <img src={item.image} alt={item.title} className="w-10 h-10 rounded object-cover" />}
                    <div>
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">x{item.quantity}</p>
                    </div>
                  </div>
                  <p className="text-sm font-medium">{formatPrice(item.price * item.quantity, order.currency)}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Shipping address */}
        {shipping && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="bg-card border border-border rounded-xl p-4 mb-6">
            <h3 className="font-semibold text-sm mb-2 flex items-center gap-2"><MapPin className="w-4 h-4 text-primary" />{t.shippingAddress}</h3>
            <div className="text-sm text-muted-foreground space-y-0.5">
              {shipping.name && <p className="text-foreground font-medium">{shipping.name}</p>}
              {shipping.address && <p>{shipping.address}</p>}
              {(shipping.zip || shipping.city) && <p>{[shipping.zip, shipping.city].filter(Boolean).join(' ')}</p>}
              {shipping.country && <p>{shipping.country}</p>}
              {shipping.phone && <p>{shipping.phone}</p>}
            </div>
          </motion.div>
        )}

        {/* Track link */}
        <div className="text-center">
          <Link to={`/track-order?q=${order.order_number || order.id}`}>
            <Button variant="outline" className="gap-2">
              <ExternalLink className="w-4 h-4" />
              {t.trackOrder}
            </Button>
          </Link>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default OrderDetail;
