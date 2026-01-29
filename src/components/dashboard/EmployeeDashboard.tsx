import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Briefcase, Package, MessageCircle, Clock, Check, X,
  ChevronDown, ChevronUp, Search, Eye, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/context/LanguageContext';
import { toast } from 'sonner';
import ReviewStars from '@/components/reviews/ReviewStars';

interface Order {
  id: string;
  order_email: string;
  status: string;
  total_amount: number;
  currency: string;
  created_at: string;
  shopify_order_number: string | null;
}

interface Review {
  id: string;
  product_title: string;
  rating: number;
  comment: string;
  is_approved: boolean;
  created_at: string;
  user_id: string;
}

const EmployeeDashboard = () => {
  const { language } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [pendingReviews, setPendingReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('orders');

  const content = {
    sv: {
      title: 'Support-panel',
      subtitle: 'Hantera ordrar och recensioner',
      tabs: {
        orders: 'Ordrar',
        reviews: 'Väntande recensioner'
      },
      orders: {
        search: 'Sök ordernummer eller e-post...',
        empty: 'Inga ordrar hittades',
        status: {
          pending: 'Väntande',
          processing: 'Behandlas',
          shipped: 'Skickad',
          delivered: 'Levererad',
          cancelled: 'Avbruten'
        }
      },
      reviews: {
        empty: 'Inga väntande recensioner',
        approve: 'Godkänn',
        reject: 'Neka',
        approved: 'Godkänd!',
        rejected: 'Nekad'
      }
    },
    en: {
      title: 'Support Panel',
      subtitle: 'Manage orders and reviews',
      tabs: {
        orders: 'Orders',
        reviews: 'Pending Reviews'
      },
      orders: {
        search: 'Search order number or email...',
        empty: 'No orders found',
        status: {
          pending: 'Pending',
          processing: 'Processing',
          shipped: 'Shipped',
          delivered: 'Delivered',
          cancelled: 'Cancelled'
        }
      },
      reviews: {
        empty: 'No pending reviews',
        approve: 'Approve',
        reject: 'Reject',
        approved: 'Approved!',
        rejected: 'Rejected'
      }
    }
  };

  const t = content[language as keyof typeof content] || content.en;

  useEffect(() => {
    if (isExpanded) {
      loadData();
    }
  }, [isExpanded]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load recent orders
      const { data: ordersData } = await supabase
        .from('orders')
        .select('id, order_email, status, total_amount, currency, created_at, shopify_order_number')
        .order('created_at', { ascending: false })
        .limit(20);

      setOrders(ordersData || []);

      // Load pending reviews
      const { data: reviewsData } = await supabase
        .from('reviews')
        .select('id, product_title, rating, comment, is_approved, created_at, user_id')
        .eq('is_approved', false)
        .order('created_at', { ascending: false })
        .limit(10);

      setPendingReviews(reviewsData || []);
    } catch (error) {
      console.error('Failed to load employee data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproveReview = async (reviewId: string) => {
    try {
      const { error } = await supabase
        .from('reviews')
        .update({ is_approved: true })
        .eq('id', reviewId);

      if (error) throw error;

      setPendingReviews(prev => prev.filter(r => r.id !== reviewId));
      toast.success(t.reviews.approved);
    } catch (error) {
      console.error('Failed to approve review:', error);
      toast.error('Failed to approve review');
    }
  };

  const handleRejectReview = async (reviewId: string) => {
    try {
      const { error } = await supabase
        .from('reviews')
        .delete()
        .eq('id', reviewId);

      if (error) throw error;

      setPendingReviews(prev => prev.filter(r => r.id !== reviewId));
      toast.success(t.reviews.rejected);
    } catch (error) {
      console.error('Failed to reject review:', error);
      toast.error('Failed to reject review');
    }
  };

  const filteredOrders = orders.filter(order => 
    order.order_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.shopify_order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; label: string }> = {
      pending: { color: 'bg-yellow-100 text-yellow-700', label: t.orders.status.pending },
      processing: { color: 'bg-blue-100 text-blue-700', label: t.orders.status.processing },
      shipped: { color: 'bg-purple-100 text-purple-700', label: t.orders.status.shipped },
      delivered: { color: 'bg-green-100 text-green-700', label: t.orders.status.delivered },
      cancelled: { color: 'bg-red-100 text-red-700', label: t.orders.status.cancelled }
    };
    const config = statusConfig[status] || statusConfig.pending;
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(language === 'sv' ? 'sv-SE' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-primary/20 rounded-2xl overflow-hidden"
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-6 flex items-center justify-between hover:bg-primary/5 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Briefcase className="w-6 h-6 text-primary" />
          </div>
          <div className="text-left">
            <h3 className="font-display text-lg font-semibold">{t.title}</h3>
            <p className="text-sm text-muted-foreground">{t.subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {pendingReviews.length > 0 && (
            <Badge variant="destructive">{pendingReviews.length}</Badge>
          )}
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="px-6 pb-6 border-t border-border">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
              <TabsList className="mb-4">
                <TabsTrigger value="orders" className="gap-2">
                  <Package className="w-4 h-4" />
                  {t.tabs.orders}
                </TabsTrigger>
                <TabsTrigger value="reviews" className="gap-2">
                  <MessageCircle className="w-4 h-4" />
                  {t.tabs.reviews}
                  {pendingReviews.length > 0 && (
                    <Badge variant="secondary" className="ml-1">{pendingReviews.length}</Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              {/* Orders Tab */}
              <TabsContent value="orders">
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={t.orders.search}
                    className="pl-10"
                  />
                </div>

                {filteredOrders.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">{t.orders.empty}</p>
                ) : (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {filteredOrders.map((order) => (
                      <div
                        key={order.id}
                        className="p-4 bg-secondary/30 rounded-lg flex items-center justify-between"
                      >
                        <div>
                          <p className="font-medium">
                            {order.shopify_order_number || order.id.slice(0, 8)}
                          </p>
                          <p className="text-sm text-muted-foreground">{order.order_email}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(order.created_at)}</p>
                        </div>
                        <div className="text-right">
                          {getStatusBadge(order.status)}
                          <p className="text-sm font-medium mt-1">
                            {order.total_amount} {order.currency}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Reviews Tab */}
              <TabsContent value="reviews">
                {pendingReviews.length === 0 ? (
                  <div className="text-center py-8">
                    <Check className="w-12 h-12 mx-auto mb-3 text-green-500" />
                    <p className="text-muted-foreground">{t.reviews.empty}</p>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[400px] overflow-y-auto">
                    {pendingReviews.map((review) => (
                      <div
                        key={review.id}
                        className="p-4 bg-secondary/30 rounded-lg"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-medium">{review.product_title}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <ReviewStars rating={review.rating} size="sm" />
                              <span className="text-xs text-muted-foreground">
                                {formatDate(review.created_at)}
                              </span>
                            </div>
                          </div>
                          <Badge className="bg-yellow-100 text-yellow-700">
                            <Clock className="w-3 h-3 mr-1" />
                            {language === 'sv' ? 'Väntande' : 'Pending'}
                          </Badge>
                        </div>
                        <p className="text-sm text-foreground/80 mb-3">{review.comment}</p>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleApproveReview(review.id)}
                            className="gap-1"
                          >
                            <Check className="w-4 h-4" />
                            {t.reviews.approve}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRejectReview(review.id)}
                            className="gap-1 text-destructive hover:text-destructive"
                          >
                            <X className="w-4 h-4" />
                            {t.reviews.reject}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default EmployeeDashboard;
