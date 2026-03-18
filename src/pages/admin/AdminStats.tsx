import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp, Package, RefreshCw, Search, Eye, ShoppingCart,
  AlertTriangle, BarChart3, MousePointerClick, Lightbulb, CheckCircle, XCircle,
  Plus, Minus, LogOut, DollarSign, Target, Activity, Trash2, Shield,
  Clock, User, Info, ArrowRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useFounderRole } from '@/hooks/useFounderRole';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

interface ProductSale {
  id: string;
  shopify_product_id: string;
  product_title: string;
  total_quantity_sold: number;
  last_sale_at: string | null;
}

interface SearchWithProduct {
  search_term: string;
  count: number;
  results_count: number;
  matched_product: string | null;
  has_results: boolean;
}

interface LogEntry {
  id: string;
  created_at: string;
  log_type: string;
  category: string;
  message: string;
  details: any;
  order_id: string | null;
  user_id: string | null;
}

const typeConfig: Record<string, { icon: any; color: string }> = {
  success: { icon: CheckCircle, color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  error: { icon: AlertTriangle, color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  warning: { icon: AlertTriangle, color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  info: { icon: Info, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
};

const AdminStats = () => {
  const { isFounder } = useFounderRole();
  const [loading, setLoading] = useState(true);
  const [topProducts, setTopProducts] = useState<ProductSale[]>([]);
  const [totalSold, setTotalSold] = useState(0);
  const [productViews, setProductViews] = useState<{ title: string; count: number }[]>([]);
  const [searchesWithProducts, setSearchesWithProducts] = useState<SearchWithProduct[]>([]);
  const [demandSearches, setDemandSearches] = useState<SearchWithProduct[]>([]);
  const [checkoutStats, setCheckoutStats] = useState({ starts: 0, completes: 0, abandons: 0 });
  const [cartAdds, setCartAdds] = useState<{ title: string; count: number }[]>([]);
  const [cartRemoves, setCartRemoves] = useState<{ title: string; count: number }[]>([]);
  const [abandonedItems, setAbandonedItems] = useState<{ title: string; count: number; totalValue: number }[]>([]);
  const [orderStats, setOrderStats] = useState({ avgOrder: 0, medianOrder: 0, totalRevenue: 0, paidCount: 0, ranges: [] as { label: string; count: number }[] });
  const [recentLogs, setRecentLogs] = useState<LogEntry[]>([]);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  useEffect(() => {
    fetchAllData();

    // Realtime activity log subscription
    const channel = supabase
      .channel('stats-activity-log')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_logs' }, (payload) => {
        const newLog = payload.new as LogEntry;
        setRecentLogs(prev => [newLog, ...prev].slice(0, 50));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([fetchSalesData(), fetchSearchData(), fetchAnalyticsData(), fetchOrderStats(), fetchRecentLogs()]);
    setLoading(false);
  };

  const fetchRecentLogs = async () => {
    try {
      const { data } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      setRecentLogs((data || []) as LogEntry[]);
    } catch (e) {
      console.error('Failed to fetch logs:', e);
    }
  };

  const fetchSalesData = async () => {
    try {
      const { data } = await supabase.from('product_sales').select('*').order('total_quantity_sold', { ascending: false });
      const sales = (data || []) as ProductSale[];
      setTopProducts(sales.slice(0, 10));
      setTotalSold(sales.reduce((sum, item) => sum + item.total_quantity_sold, 0));
    } catch (e) {
      console.error('Error fetching sales:', e);
    }
  };

  const fetchSearchData = async () => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const [searchRes, productsRes] = await Promise.all([
        supabase.from('search_logs').select('search_term, results_count').gte('created_at', thirtyDaysAgo.toISOString()),
        supabase.from('products').select('title_sv, title_en').eq('is_visible', true),
      ]);
      const searches = searchRes.data || [];
      const products = productsRes.data || [];
      const productTitles = products.map(p => p.title_sv?.toLowerCase()).filter(Boolean);
      const productTitlesEn = products.map(p => p.title_en?.toLowerCase()).filter(Boolean);

      const agg: Record<string, { count: number; totalResults: number }> = {};
      searches.forEach(s => {
        const term = s.search_term.toLowerCase();
        if (!agg[term]) agg[term] = { count: 0, totalResults: 0 };
        agg[term].count++;
        agg[term].totalResults += s.results_count || 0;
      });

      const all: SearchWithProduct[] = Object.entries(agg)
        .map(([search_term, { count, totalResults }]) => {
          const avgResults = Math.round(totalResults / count);
          const matched = productTitles.find(t => t && t.includes(search_term)) ||
            productTitlesEn.find(t => t && t.includes(search_term));
          return {
            search_term, count, results_count: avgResults,
            matched_product: matched ? products.find(p =>
              p.title_sv?.toLowerCase() === matched || p.title_en?.toLowerCase() === matched
            )?.title_sv || null : null,
            has_results: avgResults > 0,
          };
        })
        .sort((a, b) => b.count - a.count);

      setSearchesWithProducts(all.filter(s => s.has_results).slice(0, 20));
      setDemandSearches(all.filter(s => !s.has_results).slice(0, 20));
    } catch (e) {
      console.error('Failed to fetch searches:', e);
    }
  };

  const fetchOrderStats = async () => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data } = await supabase
        .from('orders')
        .select('total_amount, payment_status')
        .eq('payment_status', 'paid')
        .gte('created_at', thirtyDaysAgo.toISOString());

      const amounts = (data || []).map(o => Number(o.total_amount || 0)).filter(a => a > 0).sort((a, b) => a - b);
      const total = amounts.reduce((s, a) => s + a, 0);
      const avg = amounts.length > 0 ? Math.round(total / amounts.length) : 0;
      const median = amounts.length > 0 ? amounts[Math.floor(amounts.length / 2)] : 0;

      const rangesDef = [
        { label: '0–99 kr', min: 0, max: 99 },
        { label: '100–249 kr', min: 100, max: 249 },
        { label: '250–499 kr', min: 250, max: 499 },
        { label: '500–999 kr', min: 500, max: 999 },
        { label: '1 000+ kr', min: 1000, max: Infinity },
      ];
      const ranges = rangesDef.map(r => ({
        label: r.label,
        count: amounts.filter(a => a >= r.min && a <= r.max).length,
      }));

      setOrderStats({ avgOrder: avg, medianOrder: median, totalRevenue: total, paidCount: amounts.length, ranges });
    } catch (e) {
      console.error('Failed to fetch order stats:', e);
    }
  };

  const fetchAnalyticsData = async () => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data } = await supabase
        .from('analytics_events')
        .select('event_type, event_data')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .in('event_type', [
          'product_view', 'checkout_start', 'checkout_complete', 'checkout_abandon',
          'add_to_cart', 'remove_from_cart', 'checkout_abandon_detail'
        ])
        .limit(1000);

      if (data) {
        const viewCounts: Record<string, number> = {};
        const addCounts: Record<string, number> = {};
        const removeCounts: Record<string, number> = {};
        const abandonItemCounts: Record<string, { count: number; totalValue: number }> = {};
        let starts = 0, completes = 0, abandons = 0;

        data.forEach((e: any) => {
          if (e.event_type === 'product_view') {
            const title = e.event_data?.product_title || 'Okänd';
            viewCounts[title] = (viewCounts[title] || 0) + 1;
          }
          if (e.event_type === 'add_to_cart') {
            const title = e.event_data?.product_title || 'Okänd';
            addCounts[title] = (addCounts[title] || 0) + (e.event_data?.quantity || 1);
          }
          if (e.event_type === 'remove_from_cart') {
            const title = e.event_data?.product_title || 'Okänd';
            removeCounts[title] = (removeCounts[title] || 0) + (e.event_data?.quantity || 1);
          }
          if (e.event_type === 'checkout_abandon_detail' && Array.isArray(e.event_data?.items)) {
            e.event_data.items.forEach((item: any) => {
              const title = item.title || 'Okänd';
              if (!abandonItemCounts[title]) abandonItemCounts[title] = { count: 0, totalValue: 0 };
              abandonItemCounts[title].count += item.quantity || 1;
              abandonItemCounts[title].totalValue += (item.price || 0) * (item.quantity || 1);
            });
          }
          if (e.event_type === 'checkout_start') starts++;
          if (e.event_type === 'checkout_complete') completes++;
          if (e.event_type === 'checkout_abandon') abandons++;
        });

        setProductViews(Object.entries(viewCounts).map(([title, count]) => ({ title, count })).sort((a, b) => b.count - a.count).slice(0, 10));
        setCartAdds(Object.entries(addCounts).map(([title, count]) => ({ title, count })).sort((a, b) => b.count - a.count).slice(0, 15));
        setCartRemoves(Object.entries(removeCounts).map(([title, count]) => ({ title, count })).sort((a, b) => b.count - a.count).slice(0, 15));
        setAbandonedItems(Object.entries(abandonItemCounts).map(([title, data]) => ({ title, count: data.count, totalValue: data.totalValue })).sort((a, b) => b.count - a.count).slice(0, 15));
        setCheckoutStats({ starts, completes, abandons });
      }
    } catch (e) {
      console.error('Failed to fetch analytics:', e);
    }
  };

  // Founder-only: clear data
  const handleClearProductSales = async () => {
    const { error } = await supabase.from('product_sales').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) { toast.error('Kunde inte rensa försäljningsdata'); return; }
    toast.success('Försäljningsdata rensad');
    setTopProducts([]);
    setTotalSold(0);
  };

  const handleClearSearchLogs = async () => {
    const { error } = await supabase.from('search_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) { toast.error('Kunde inte rensa sökloggar'); return; }
    toast.success('Sökloggar rensade');
    setSearchesWithProducts([]);
    setDemandSearches([]);
  };

  const handleClearAnalytics = async () => {
    const { error } = await supabase.from('analytics_events').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) { toast.error('Kunde inte rensa analytics'); return; }
    toast.success('Analytics-data rensad');
    setProductViews([]);
    setCartAdds([]);
    setCartRemoves([]);
    setAbandonedItems([]);
    setCheckoutStats({ starts: 0, completes: 0, abandons: 0 });
  };

  const handleDeleteSaleEntry = async (id: string) => {
    const { error } = await supabase.from('product_sales').delete().eq('id', id);
    if (error) { toast.error('Kunde inte ta bort'); return; }
    setTopProducts(prev => prev.filter(p => p.id !== id));
    toast.success('Post borttagen');
  };

  const conversionRate = checkoutStats.starts > 0 ? Math.round((checkoutStats.completes / checkoutStats.starts) * 100) : 0;
  const fmt = (n: number) => new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', minimumFractionDigits: 0 }).format(n);

  const formatLogTime = (d: string) => {
    const date = new Date(d);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just nu';
    if (diffMins < 60) return `${diffMins}m sedan`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h sedan`;
    return date.toLocaleDateString('sv-SE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  }

  const ConfirmClearButton = ({ onConfirm, label }: { onConfirm: () => void; label: string }) => (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm" className="gap-1.5 text-xs">
          <Trash2 className="w-3.5 h-3.5" /> {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Rensa data?</AlertDialogTitle>
          <AlertDialogDescription>
            Detta raderar all data permanent. Åtgärden kan inte ångras.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Avbryt</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Rensa permanent
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Statistik</h1>
          <p className="text-muted-foreground text-sm mt-1">Senaste 30 dagarna</p>
        </div>
        <Button onClick={fetchAllData} variant="outline" size="sm" className="gap-2">
          <RefreshCw className="w-4 h-4" /> Uppdatera
        </Button>
      </div>

      {/* Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase">Sålda produkter</span>
              <Package className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">{totalSold}</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase">Visningar</span>
              <Eye className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">{productViews.reduce((s, v) => s + v.count, 0)}</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase">Sökningar</span>
              <Search className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">{searchesWithProducts.reduce((s, t) => s + t.count, 0) + demandSearches.reduce((s, t) => s + t.count, 0)}</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase">Konvertering</span>
              <ShoppingCart className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">{conversionRate}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Real-time Activity Summary */}
      {(() => {
        const errorLogs = recentLogs.filter(l => l.log_type === 'error');
        const warningLogs = recentLogs.filter(l => l.log_type === 'warning');
        const securityLogs = recentLogs.filter(l => l.category === 'security');
        const adminLogs = recentLogs.filter(l => l.category === 'admin');
        const orderLogs = recentLogs.filter(l => l.category === 'order');

        return (
          <div className="space-y-4">
            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="rounded-lg border border-border bg-secondary/30 p-3 text-center">
                <div className="relative mx-auto w-fit">
                  <Activity className="w-4 h-4 text-primary mx-auto mb-1" />
                  <span className="absolute -top-0.5 -right-1.5 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                </div>
                <p className="text-2xl font-bold">{recentLogs.length}</p>
                <p className="text-xs text-muted-foreground">Totalt</p>
              </div>
              <div className={`rounded-lg border p-3 text-center ${errorLogs.length > 0 ? 'border-destructive/30 bg-destructive/5' : 'border-border bg-secondary/30'}`}>
                <AlertTriangle className={`w-4 h-4 mx-auto mb-1 ${errorLogs.length > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
                <p className={`text-2xl font-bold ${errorLogs.length > 0 ? 'text-destructive' : ''}`}>{errorLogs.length}</p>
                <p className="text-xs text-muted-foreground">Fel</p>
              </div>
              <div className={`rounded-lg border p-3 text-center ${warningLogs.length > 0 ? 'border-yellow-400/30 bg-yellow-50 dark:bg-yellow-900/10' : 'border-border bg-secondary/30'}`}>
                <AlertTriangle className={`w-4 h-4 mx-auto mb-1 ${warningLogs.length > 0 ? 'text-yellow-600' : 'text-muted-foreground'}`} />
                <p className={`text-2xl font-bold ${warningLogs.length > 0 ? 'text-yellow-600' : ''}`}>{warningLogs.length}</p>
                <p className="text-xs text-muted-foreground">Varningar</p>
              </div>
              <div className="rounded-lg border border-border bg-secondary/30 p-3 text-center">
                <Shield className="w-4 h-4 text-muted-foreground mx-auto mb-1" />
                <p className="text-2xl font-bold">{securityLogs.length}</p>
                <p className="text-xs text-muted-foreground">Säkerhet</p>
              </div>
              <div className="rounded-lg border border-border bg-secondary/30 p-3 text-center">
                <User className="w-4 h-4 text-muted-foreground mx-auto mb-1" />
                <p className="text-2xl font-bold">{adminLogs.length}</p>
                <p className="text-xs text-muted-foreground">Admin</p>
              </div>
            </div>

            {/* Recent 5 entries preview */}
            <Card className="border-border">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <div className="relative">
                      <Activity className="w-4 h-4 text-primary" />
                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    </div>
                    Senaste händelser
                  </CardTitle>
                  <Link to="/admin/logs" className="text-xs text-primary hover:underline flex items-center gap-1">
                    Visa alla loggar <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  {recentLogs.length === 0 ? (
                    <p className="text-center text-muted-foreground py-6 text-sm">Inga loggposter ännu</p>
                  ) : (
                    recentLogs.slice(0, 5).map((log) => {
                      const cfg = typeConfig[log.log_type] || typeConfig.info;
                      const Icon = cfg.icon;
                      return (
                        <motion.div
                          key={log.id}
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex items-center gap-2.5 rounded-lg bg-secondary/20 px-3 py-2"
                        >
                          <div className={`p-1 rounded ${cfg.color}`}>
                            <Icon className="w-3 h-3" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{log.message}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" />
                                {formatLogTime(log.created_at)}
                              </span>
                              <Badge variant="outline" className="text-[10px] h-4">{log.category}</Badge>
                              {log.details?.user_email && (
                                <span className="text-[11px] text-muted-foreground flex items-center gap-1 truncate max-w-[150px]">
                                  <User className="w-2.5 h-2.5 shrink-0" />
                                  {log.details.user_email}
                                </span>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        );
      })()}

      <Tabs defaultValue="searches" className="space-y-4">
        <TabsList className="bg-secondary/50 flex-wrap">
          <TabsTrigger value="searches">Sökningar</TabsTrigger>
          <TabsTrigger value="demand">
            Efterfrågan
            {demandSearches.length > 0 && (
              <Badge variant="destructive" className="ml-2 text-[10px] px-1.5 py-0">{demandSearches.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="sales">Försäljning</TabsTrigger>
          <TabsTrigger value="views">Visningar</TabsTrigger>
          <TabsTrigger value="cart">Kundvagn</TabsTrigger>
          <TabsTrigger value="checkout">Checkout</TabsTrigger>
          <TabsTrigger value="abandoned">
            Övergivna
            {abandonedItems.length > 0 && (
              <Badge variant="destructive" className="ml-2 text-[10px] px-1.5 py-0">{abandonedItems.length}</Badge>
            )}
          </TabsTrigger>
          {isFounder && <TabsTrigger value="settings">⚙️ Hantera</TabsTrigger>}
        </TabsList>

        {/* Searches */}
        <TabsContent value="searches">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Search className="w-5 h-5 text-primary" /> Sökningar som hittade produkter
              </CardTitle>
              <p className="text-sm text-muted-foreground">Visar vad kunder söker på och vilka produkter som matchas</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {searchesWithProducts.map((s, idx) => (
                  <div key={s.search_term} className="flex items-center justify-between p-3 rounded-xl bg-secondary/50">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">{idx + 1}</div>
                      <div>
                        <span className="font-medium text-sm">"{s.search_term}"</span>
                        {s.matched_product && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <CheckCircle className="w-3 h-3 text-green-500" />
                            {s.matched_product}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{s.count} sökningar</Badge>
                      <Badge className="bg-accent/10 text-accent border-0">{s.results_count} träffar</Badge>
                    </div>
                  </div>
                ))}
                {searchesWithProducts.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p>Inga sökningar registrerade ännu</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Demand */}
        <TabsContent value="demand">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-primary" /> Efterfrågade produkter
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Sökningar som <strong>inte gav resultat</strong> — kunder letar efter dessa men ni har inga matchande produkter
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {demandSearches.map((s, idx) => (
                  <motion.div
                    key={s.search_term}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className="flex items-center justify-between p-3 rounded-xl bg-destructive/5 border border-destructive/10"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-destructive/10 flex items-center justify-center text-xs font-bold text-destructive">{idx + 1}</div>
                      <div>
                        <span className="font-medium text-sm">"{s.search_term}"</span>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <XCircle className="w-3 h-3 text-destructive" />
                          Ingen produkt hittades
                        </p>
                      </div>
                    </div>
                    <Badge className="bg-destructive/10 text-destructive border-0 font-bold">
                      {s.count} {s.count === 1 ? 'sökning' : 'sökningar'}
                    </Badge>
                  </motion.div>
                ))}
                {demandSearches.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500/30" />
                    <p>Alla sökningar har hittat produkter — bra jobbat!</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sales */}
        <TabsContent value="sales">
          <Card className="border-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold flex items-center gap-2"><TrendingUp className="w-5 h-5 text-accent" /> Topprodukter</CardTitle>
                {isFounder && <ConfirmClearButton onConfirm={handleClearProductSales} label="Rensa" />}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {topProducts.map((product, idx) => (
                  <div key={product.id} className="flex items-center justify-between p-3 rounded-xl bg-secondary/50">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">{idx + 1}</div>
                      <div>
                        <p className="font-medium text-sm">{product.product_title}</p>
                        {product.last_sale_at && (
                          <p className="text-xs text-muted-foreground">
                            Senast: {new Date(product.last_sale_at).toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' })}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-lg">{product.total_quantity_sold} st</span>
                      {isFounder && (
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => handleDeleteSaleEntry(product.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {topProducts.length === 0 && <div className="text-center py-8 text-muted-foreground">Ingen försäljningsdata ännu</div>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Views */}
        <TabsContent value="views">
          <Card className="border-border">
            <CardHeader><CardTitle className="text-lg font-semibold flex items-center gap-2"><Eye className="w-5 h-5 text-primary" /> Mest visade produkter</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {productViews.map((pv, idx) => (
                  <div key={pv.title} className="flex items-center justify-between p-3 rounded-xl bg-secondary/50">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">{idx + 1}</div>
                      <span className="font-medium text-sm">{pv.title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MousePointerClick className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="font-bold">{pv.count}</span>
                    </div>
                  </div>
                ))}
                {productViews.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Eye className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p>Ingen data ännu</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Checkout */}
        <TabsContent value="checkout">
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Card className="border-border">
                <CardContent className="pt-4 pb-3 text-center">
                  <DollarSign className="w-4 h-4 mx-auto text-accent mb-1" />
                  <p className="text-xl font-bold">{fmt(orderStats.avgOrder)}</p>
                  <p className="text-xs text-muted-foreground">Snittorder</p>
                </CardContent>
              </Card>
              <Card className="border-border">
                <CardContent className="pt-4 pb-3 text-center">
                  <Target className="w-4 h-4 mx-auto text-primary mb-1" />
                  <p className="text-xl font-bold">{fmt(orderStats.medianOrder)}</p>
                  <p className="text-xs text-muted-foreground">Medianorder</p>
                </CardContent>
              </Card>
              <Card className="border-border">
                <CardContent className="pt-4 pb-3 text-center">
                  <ShoppingCart className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
                  <p className="text-xl font-bold">{orderStats.paidCount}</p>
                  <p className="text-xs text-muted-foreground">Betalda ordrar</p>
                </CardContent>
              </Card>
              <Card className="border-border">
                <CardContent className="pt-4 pb-3 text-center">
                  <TrendingUp className="w-4 h-4 mx-auto text-accent mb-1" />
                  <p className="text-xl font-bold">{fmt(orderStats.totalRevenue)}</p>
                  <p className="text-xs text-muted-foreground">Total (30d)</p>
                </CardContent>
              </Card>
            </div>

            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-accent" /> Populäraste ordersummor
                </CardTitle>
                <p className="text-sm text-muted-foreground">Fördelning av ordervärden senaste 30 dagarna</p>
              </CardHeader>
              <CardContent className="space-y-2">
                {orderStats.ranges.map(r => {
                  const maxCount = Math.max(...orderStats.ranges.map(x => x.count), 1);
                  return (
                    <div key={r.label} className="flex items-center gap-3">
                      <span className="text-sm font-medium w-24 shrink-0">{r.label}</span>
                      <div className="flex-1 h-7 rounded-lg bg-secondary/50 overflow-hidden">
                        <div
                          className="h-full bg-primary/40 rounded-lg flex items-center px-2"
                          style={{ width: `${Math.max((r.count / maxCount) * 100, r.count > 0 ? 8 : 0)}%` }}
                        >
                          {r.count > 0 && <span className="text-xs font-bold">{r.count}</span>}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground w-16 text-right">
                        {orderStats.paidCount > 0 ? Math.round((r.count / orderStats.paidCount) * 100) : 0}%
                      </span>
                    </div>
                  );
                })}
                {orderStats.paidCount === 0 && (
                  <p className="text-center py-4 text-muted-foreground text-sm">Inga betalda ordrar ännu</p>
                )}
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader><CardTitle className="text-lg font-semibold flex items-center gap-2"><BarChart3 className="w-5 h-5 text-primary" /> Checkout-tratt</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">Påbörjad</span>
                      <span className="text-sm font-bold">{checkoutStats.starts}</span>
                    </div>
                    <div className="h-8 rounded-lg bg-primary/20 overflow-hidden">
                      <div className="h-full bg-primary/60 rounded-lg" style={{ width: '100%' }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">Genomförd</span>
                      <span className="text-sm font-bold">{checkoutStats.completes}</span>
                    </div>
                    <div className="h-8 rounded-lg bg-accent/20 overflow-hidden">
                      <div className="h-full bg-accent/60 rounded-lg" style={{ width: checkoutStats.starts > 0 ? `${(checkoutStats.completes / checkoutStats.starts) * 100}%` : '0%' }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">Avbrutna</span>
                      <span className="text-sm font-bold text-destructive">{checkoutStats.abandons}</span>
                    </div>
                    <div className="h-8 rounded-lg bg-destructive/10 overflow-hidden">
                      <div className="h-full bg-destructive/40 rounded-lg" style={{ width: checkoutStats.starts > 0 ? `${(checkoutStats.abandons / checkoutStats.starts) * 100}%` : '0%' }} />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-secondary/50 text-center">
                    <p className="text-2xl font-bold text-primary">{conversionRate}%</p>
                    <p className="text-xs text-muted-foreground mt-1">Konvertering</p>
                  </div>
                  <div className="p-4 rounded-xl bg-secondary/50 text-center">
                    <p className="text-2xl font-bold text-destructive">{checkoutStats.starts > 0 ? 100 - conversionRate : 0}%</p>
                    <p className="text-xs text-muted-foreground mt-1">Drop-off</p>
                  </div>
                  <div className="p-4 rounded-xl bg-secondary/50 text-center">
                    <p className="text-2xl font-bold">{checkoutStats.starts}</p>
                    <p className="text-xs text-muted-foreground mt-1">Checkout-besök</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Cart */}
        <TabsContent value="cart">
          <div className="grid lg:grid-cols-2 gap-4">
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Plus className="w-5 h-5 text-accent" /> Lagt i kundvagn
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {cartAdds.map((item, idx) => (
                    <div key={item.title} className="flex items-center justify-between p-3 rounded-xl bg-secondary/50">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center text-xs font-bold text-accent">{idx + 1}</div>
                        <span className="font-medium text-sm">{item.title}</span>
                      </div>
                      <Badge variant="outline">{item.count} st</Badge>
                    </div>
                  ))}
                  {cartAdds.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p>Ingen data ännu</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Minus className="w-5 h-5 text-destructive" /> Borttagna ur kundvagn
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {cartRemoves.map((item, idx) => (
                    <div key={item.title} className="flex items-center justify-between p-3 rounded-xl bg-destructive/5 border border-destructive/10">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-destructive/10 flex items-center justify-center text-xs font-bold text-destructive">{idx + 1}</div>
                        <span className="font-medium text-sm">{item.title}</span>
                      </div>
                      <Badge className="bg-destructive/10 text-destructive border-0">{item.count} st</Badge>
                    </div>
                  ))}
                  {cartRemoves.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-30 text-accent" />
                      <p>Inga borttagningar — bra!</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Abandoned */}
        <TabsContent value="abandoned">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <LogOut className="w-5 h-5 text-destructive" /> Övergivna produkter i kassan
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Exakt vilka produkter kunder hade i kassan när de lämnade utan att köpa
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {abandonedItems.map((item, idx) => (
                  <div key={item.title} className="flex items-center justify-between p-3 rounded-xl bg-destructive/5 border border-destructive/10">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-destructive/10 flex items-center justify-center text-xs font-bold text-destructive">{idx + 1}</div>
                      <div>
                        <span className="font-medium text-sm">{item.title}</span>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Totalt förlorat värde: {fmt(item.totalValue)}
                        </p>
                      </div>
                    </div>
                    <Badge className="bg-destructive/10 text-destructive border-0 font-bold">
                      {item.count} st
                    </Badge>
                  </div>
                ))}
                {abandonedItems.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-30 text-accent" />
                    <p>Inga övergivna kassor ännu</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Founder-only settings tab */}
        {isFounder && (
          <TabsContent value="settings">
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" /> Datahantering (Founder)
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Rensa testdata eller gammal statistik. Dessa åtgärder är permanenta.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl border border-border bg-secondary/20 space-y-3">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-accent" />
                      <h4 className="font-medium text-sm">Försäljningsdata</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">{topProducts.length} poster i product_sales</p>
                    <ConfirmClearButton onConfirm={handleClearProductSales} label="Rensa allt" />
                  </div>

                  <div className="p-4 rounded-xl border border-border bg-secondary/20 space-y-3">
                    <div className="flex items-center gap-2">
                      <Search className="w-4 h-4 text-primary" />
                      <h4 className="font-medium text-sm">Sökloggar</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">{searchesWithProducts.length + demandSearches.length} unika söktermer</p>
                    <ConfirmClearButton onConfirm={handleClearSearchLogs} label="Rensa allt" />
                  </div>

                  <div className="p-4 rounded-xl border border-border bg-secondary/20 space-y-3">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-muted-foreground" />
                      <h4 className="font-medium text-sm">Analytics-events</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">Visningar, kundvagn, checkout etc.</p>
                    <ConfirmClearButton onConfirm={handleClearAnalytics} label="Rensa allt" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default AdminStats;
