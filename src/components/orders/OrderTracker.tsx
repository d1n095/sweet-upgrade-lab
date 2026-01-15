import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Package, Truck, MapPin, CheckCircle2, Clock, 
  Loader2, RefreshCw, ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/context/LanguageContext';
import { Link } from 'react-router-dom';

interface Order {
  id: string;
  shopify_order_number: string | null;
  status: string;
  tracking_number: string | null;
  estimated_delivery: string | null;
  total_amount: number;
  currency: string;
  items: unknown[];
  status_history: unknown[];
  created_at: string;
  updated_at: string;
}

const statusConfig: Record<string, { icon: React.ElementType; color: string; step: number }> = {
  pending: { icon: Clock, color: 'text-yellow-600', step: 1 },
  confirmed: { icon: CheckCircle2, color: 'text-blue-600', step: 2 },
  processing: { icon: Package, color: 'text-primary', step: 3 },
  shipped: { icon: Truck, color: 'text-primary', step: 4 },
  in_transit: { icon: MapPin, color: 'text-primary', step: 5 },
  delivered: { icon: CheckCircle2, color: 'text-success', step: 6 },
};

const OrderTracker = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const content = {
    sv: {
      title: 'Mina ordrar',
      subtitle: 'Följ dina ordrar i realtid',
      noOrders: 'Du har inga ordrar ännu',
      shopNow: 'Shoppa nu',
      orderNumber: 'Order',
      trackingNumber: 'Spårningsnummer',
      estimatedDelivery: 'Beräknad leverans',
      refresh: 'Uppdatera',
      statuses: {
        pending: 'Order mottagen',
        confirmed: 'Bekräftad',
        processing: 'Packas hos leverantör',
        shipped: 'Skickad',
        in_transit: 'På väg till dig',
        delivered: 'Levererad',
      },
      statusDescriptions: {
        pending: 'Din order har mottagits och behandlas',
        confirmed: 'Betalning bekräftad, förbereder för packning',
        processing: 'Din order packas hos vår leverantör',
        shipped: 'Din order har skickats',
        in_transit: 'Paketet är på väg till dig',
        delivered: 'Paketet har levererats!',
      },
    },
    en: {
      title: 'My Orders',
      subtitle: 'Track your orders in realtime',
      noOrders: "You don't have any orders yet",
      shopNow: 'Shop now',
      orderNumber: 'Order',
      trackingNumber: 'Tracking number',
      estimatedDelivery: 'Estimated delivery',
      refresh: 'Refresh',
      statuses: {
        pending: 'Order received',
        confirmed: 'Confirmed',
        processing: 'Packing at supplier',
        shipped: 'Shipped',
        in_transit: 'In transit to you',
        delivered: 'Delivered',
      },
      statusDescriptions: {
        pending: 'Your order has been received and is being processed',
        confirmed: 'Payment confirmed, preparing for packing',
        processing: 'Your order is being packed at our supplier',
        shipped: 'Your order has been shipped',
        in_transit: 'The package is on its way to you',
        delivered: 'Your package has been delivered!',
      },
    }
  };

  const t = content[language as keyof typeof content] || content.en;

  useEffect(() => {
    if (user) {
      loadOrders();
      
      // Subscribe to realtime updates
      const channel = supabase
        .channel('orders-updates')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'orders',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              setOrders(prev => [payload.new as Order, ...prev]);
            } else if (payload.eventType === 'UPDATE') {
              setOrders(prev => 
                prev.map(order => 
                  order.id === (payload.new as Order).id 
                    ? payload.new as Order 
                    : order
                )
              );
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const loadOrders = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      // Cast the data to match our Order interface
      setOrders((data || []) as unknown as Order[]);
    } catch (error) {
      console.error('Failed to load orders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(language === 'sv' ? 'sv-SE' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatPrice = (amount: number, currency: string) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusStep = (status: string) => {
    return statusConfig[status]?.step || 1;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-12 bg-secondary/30 rounded-2xl">
        <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
        <p className="text-lg font-medium mb-2">{t.noOrders}</p>
        <Link to="/shop">
          <Button className="mt-4">{t.shopNow}</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Package className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">{t.title}</h3>
            <p className="text-sm text-muted-foreground">{t.subtitle}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={loadOrders} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          {t.refresh}
        </Button>
      </div>

      <div className="space-y-4">
        {orders.map((order) => {
          const currentStep = getStatusStep(order.status);
          const StatusIcon = statusConfig[order.status]?.icon || Clock;
          const statusColor = statusConfig[order.status]?.color || 'text-muted-foreground';

          return (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card border border-border rounded-xl overflow-hidden"
            >
              {/* Order Header */}
              <div className="p-4 border-b border-border/50 bg-secondary/30">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">
                        {t.orderNumber} #{order.shopify_order_number || order.id.slice(0, 8)}
                      </span>
                      <Badge className={`${statusColor} bg-transparent border`}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {t.statuses[order.status as keyof typeof t.statuses] || order.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {formatDate(order.created_at)}
                    </p>
                  </div>
                  <p className="font-bold text-primary">
                    {formatPrice(order.total_amount, order.currency)}
                  </p>
                </div>
              </div>

              {/* Progress Steps */}
              <div className="p-4">
                <div className="relative">
                  {/* Progress Line */}
                  <div className="absolute top-4 left-4 right-4 h-0.5 bg-border">
                    <motion.div
                      className="h-full bg-primary"
                      initial={{ width: 0 }}
                      animate={{ width: `${((currentStep - 1) / 5) * 100}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                    />
                  </div>

                  {/* Steps */}
                  <div className="flex justify-between relative">
                    {Object.entries(statusConfig).map(([status, config], index) => {
                      const isCompleted = config.step <= currentStep;
                      const isCurrent = config.step === currentStep;
                      const Icon = config.icon;

                      return (
                        <div key={status} className="flex flex-col items-center">
                          <motion.div
                            className={`w-8 h-8 rounded-full flex items-center justify-center z-10 transition-colors ${
                              isCompleted
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-muted-foreground'
                            } ${isCurrent ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                            initial={{ scale: 0.8 }}
                            animate={{ scale: isCurrent ? 1.1 : 1 }}
                          >
                            <Icon className="w-4 h-4" />
                          </motion.div>
                          <span className={`text-xs mt-2 text-center max-w-[60px] ${
                            isCompleted ? 'text-foreground font-medium' : 'text-muted-foreground'
                          }`}>
                            {t.statuses[status as keyof typeof t.statuses]}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Status Description */}
                <div className="mt-6 p-3 bg-secondary/50 rounded-lg">
                  <p className="text-sm">
                    {t.statusDescriptions[order.status as keyof typeof t.statusDescriptions]}
                  </p>
                </div>

                {/* Tracking & Delivery Info */}
                <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                  {order.tracking_number && (
                    <div>
                      <p className="text-muted-foreground text-xs">{t.trackingNumber}</p>
                      <p className="font-mono font-medium">{order.tracking_number}</p>
                    </div>
                  )}
                  {order.estimated_delivery && (
                    <div>
                      <p className="text-muted-foreground text-xs">{t.estimatedDelivery}</p>
                      <p className="font-medium">{formatDate(order.estimated_delivery)}</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default OrderTracker;
