import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp, Package, RefreshCw, Search, Eye, ShoppingCart,
  AlertTriangle, BarChart3, MousePointerClick, Lightbulb, CheckCircle, XCircle,
  Plus, Minus, LogOut, DollarSign, Target, Activity, Trash2, Shield,
  Clock, User, Info, ArrowRight, Calendar, TrendingDown, Ban, HelpCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger, ScrollableTabs } from '@/components/ui/tabs';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { useFounderRole } from '@/hooks/useFounderRole';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

// ─── Types ───────────────────────────────────────────────────
interface DashboardStats {
  orders: {
    total_revenue: number;
    gross_revenue: number;
    total_refunds: number;
    paid_count: number;
    failed_count: number;
    pending_count: number;
    refunded_count: number;
    total_orders: number;
    avg_order: number;
    median_order: number;
    ranges: { label: string; count: number }[];
  };
  analytics: {
    product_views: number;
    cart_adds: number;
    cart_removes: number;
    checkout_starts: number;
    checkout_completes: number;
    checkout_abandons: number;
  };
  searches: {
    total_searches: number;
    with_results: number;
    without_results: number;
  };
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

type DateRange = 'today' | '7d' | '30d' | 'all';

// ─── Constants ───────────────────────────────────────────────
const typeConfig: Record<string, { icon: any; color: string }> = {
  success: { icon: CheckCircle, color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  error: { icon: AlertTriangle, color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  warning: { icon: AlertTriangle, color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  info: { icon: Info, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  purchase: { icon: DollarSign, color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  order: { icon: ShoppingCart, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
};

// Helper: show "–" for zero values with no data context
const noData = (value: number, formatted?: string) => {
  if (value === 0) return '–';
  return formatted ?? String(value);
};

const hasAnyData = (stats: DashboardStats) => {
  return stats.orders.total_orders > 0 || stats.analytics.product_views > 0 || stats.searches.total_searches > 0;
};

const dateRangeOptions: { value: DateRange; label: string }[] = [
  { value: 'today', label: 'Idag' },
  { value: '7d', label: '7 dagar' },
  { value: '30d', label: '30 dagar' },
  { value: 'all', label: 'Allt' },
];

function getDateRange(range: DateRange): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString();
  if (range === 'today') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return { from: start.toISOString(), to };
  }
  if (range === '7d') {
    const start = new Date(now);
    start.setDate(start.getDate() - 7);
    return { from: start.toISOString(), to };
  }
  if (range === '30d') {
    const start = new Date(now);
    start.setDate(start.getDate() - 30);
    return { from: start.toISOString(), to };
  }
  // all
  return { from: '2020-01-01T00:00:00.000Z', to };
}

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

const emptyStats: DashboardStats = {
  orders: { total_revenue: 0, gross_revenue: 0, total_refunds: 0, paid_count: 0, failed_count: 0, pending_count: 0, refunded_count: 0, total_orders: 0, avg_order: 0, median_order: 0, ranges: [] },
  analytics: { product_views: 0, cart_adds: 0, cart_removes: 0, checkout_starts: 0, checkout_completes: 0, checkout_abandons: 0 },
  searches: { total_searches: 0, with_results: 0, without_results: 0 },
};

// ─── Component ───────────────────────────────────────────────
const AdminStats = () => {
  const { isFounder } = useFounderRole();
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [stats, setStats] = useState<DashboardStats>(emptyStats);

  // Detailed data (client-side for lists)
  const [productViews, setProductViews] = useState<{ title: string; count: number }[]>([]);
  const [searchesWithProducts, setSearchesWithProducts] = useState<SearchWithProduct[]>([]);
  const [demandSearches, setDemandSearches] = useState<SearchWithProduct[]>([]);
  const [cartAdds, setCartAdds] = useState<{ title: string; count: number }[]>([]);
  const [cartRemoves, setCartRemoves] = useState<{ title: string; count: number }[]>([]);
  const [abandonedItems, setAbandonedItems] = useState<{ title: string; count: number; totalValue: number }[]>([]);
  const [recentLogs, setRecentLogs] = useState<LogEntry[]>([]);

  const { from, to } = useMemo(() => getDateRange(dateRange), [dateRange]);

  useEffect(() => {
    fetchAllData();
  }, [dateRange]);

  useEffect(() => {
    // Realtime subscriptions
    const channel = supabase
      .channel('stats-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_logs' }, (payload) => {
        setRecentLogs(prev => [payload.new as LogEntry, ...prev].slice(0, 50));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        // Refresh stats when orders change
        fetchDashboardStats();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [from, to]);

  const fetchDashboardStats = async () => {
    try {
      const { data, error } = await supabase.rpc('get_dashboard_stats', {
        p_from: from,
        p_to: to,
      });
      if (error) throw error;
      if (data) {
        setStats(data as unknown as DashboardStats);
      }
    } catch (e) {
      console.error('Failed to fetch dashboard stats:', e);
    }
  };

  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([
      fetchDashboardStats(),
      fetchSearchDetails(),
      fetchAnalyticsDetails(),
      fetchRecentLogs(),
    ]);
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

  const fetchSearchDetails = async () => {
    try {
      const [searchRes, productsRes] = await Promise.all([
        supabase.from('search_logs').select('search_term, results_count').gte('created_at', from).lte('created_at', to),
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

  const fetchAnalyticsDetails = async () => {
    try {
      const { data } = await supabase
        .from('analytics_events')
        .select('event_type, event_data')
        .gte('created_at', from)
        .lte('created_at', to)
        .in('event_type', [
          'product_view', 'add_to_cart', 'remove_from_cart', 'checkout_abandon_detail'
        ])
        .limit(1000);

      if (data) {
        const viewCounts: Record<string, number> = {};
        const addCounts: Record<string, number> = {};
        const removeCounts: Record<string, number> = {};
        const abandonItemCounts: Record<string, { count: number; totalValue: number }> = {};

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
        });

        setProductViews(Object.entries(viewCounts).map(([title, count]) => ({ title, count })).sort((a, b) => b.count - a.count).slice(0, 10));
        setCartAdds(Object.entries(addCounts).map(([title, count]) => ({ title, count })).sort((a, b) => b.count - a.count).slice(0, 15));
        setCartRemoves(Object.entries(removeCounts).map(([title, count]) => ({ title, count })).sort((a, b) => b.count - a.count).slice(0, 15));
        setAbandonedItems(Object.entries(abandonItemCounts).map(([title, data]) => ({ title, count: data.count, totalValue: data.totalValue })).sort((a, b) => b.count - a.count).slice(0, 15));
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
  };

  const handleClearSearchLogs = async () => {
    const { error } = await supabase.from('search_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) { toast.error('Kunde inte rensa sökloggar'); return; }
    toast.success('Sökloggar rensade');
    setSearchesWithProducts([]);
    setDemandSearches([]);
    fetchDashboardStats();
  };

  const handleClearAnalytics = async () => {
    const { error } = await supabase.from('analytics_events').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) { toast.error('Kunde inte rensa analytics'); return; }
    toast.success('Analytics-data rensad');
    setProductViews([]);
    setCartAdds([]);
    setCartRemoves([]);
    setAbandonedItems([]);
    fetchDashboardStats();
  };

  // Derived values from single RPC source
  const { orders, analytics, searches } = stats;
  const conversionRate = analytics.checkout_starts > 0
    ? Math.round((analytics.checkout_completes / analytics.checkout_starts) * 100)
    : 0;

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

  const EmptyState = ({ icon: Icon, message }: { icon: any; message: string }) => (
    <div className="text-center py-8 text-muted-foreground">
      <Icon className="w-8 h-8 mx-auto mb-2 opacity-30" />
      <p className="text-sm">{message}</p>
    </div>
  );

  if (loading) {
    return <div className="flex items-center justify-center h-64"><RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  }

  const periodLabel = dateRangeOptions.find(o => o.value === dateRange)?.label || '';

  return (
    <div className="space-y-6">
      {/* Header with date filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Statistik</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Visar data för: <span className="font-medium text-foreground">{periodLabel}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-secondary/50 rounded-lg p-1 gap-0.5">
            {dateRangeOptions.map(opt => (
              <Button
                key={opt.value}
                variant={dateRange === opt.value ? 'default' : 'ghost'}
                size="sm"
                className={`text-xs h-7 px-3 ${dateRange === opt.value ? '' : 'hover:bg-secondary'}`}
                onClick={() => setDateRange(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
          <Button onClick={fetchAllData} variant="outline" size="sm" className="gap-1.5 h-7">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* No data banner */}
      {!hasAnyData(stats) && (
        <div className="rounded-lg border border-yellow-400/30 bg-yellow-50/50 dark:bg-yellow-900/10 p-4 flex items-center gap-3">
          <Info className="w-5 h-5 text-yellow-600 shrink-0" />
          <div>
            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Ingen data ännu för denna period</p>
            <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-0.5">
              Data samlas in automatiskt när besökare interagerar med butiken. Prova ett annat tidsintervall eller vänta på aktivitet.
            </p>
          </div>
        </div>
      )}

      {/* ─── Overview Cards (all from RPC) ─── */}
      <TooltipProvider delayDuration={200}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="border-border">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-xs font-medium text-muted-foreground uppercase cursor-help flex items-center gap-1">
                      Nettointäkt <HelpCircle className="w-3 h-3" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent><p className="text-xs max-w-[200px]">Bruttointäkt minus returer. Räknar bara betalda ordrar.</p></TooltipContent>
                </Tooltip>
                <DollarSign className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold">{orders.paid_count > 0 ? fmt(orders.total_revenue) : '–'}</p>
              {orders.total_refunds > 0 && (
                <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                  <TrendingDown className="w-3 h-3" />
                  {fmt(orders.total_refunds)} i returer
                </p>
              )}
              {orders.paid_count === 0 && (
                <p className="text-xs text-muted-foreground mt-1">Ingen försäljning ännu</p>
              )}
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground uppercase">Betalda ordrar</span>
                <ShoppingCart className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold">{noData(orders.paid_count)}</p>
              <div className="flex gap-2 mt-1">
                {orders.failed_count > 0 && (
                  <span className="text-xs text-destructive flex items-center gap-0.5">
                    <XCircle className="w-3 h-3" /> {orders.failed_count} misslyckade
                  </span>
                )}
                {orders.pending_count > 0 && (
                  <span className="text-xs text-yellow-600 flex items-center gap-0.5">
                    <Clock className="w-3 h-3" /> {orders.pending_count} väntande
                  </span>
                )}
                {orders.paid_count === 0 && orders.failed_count === 0 && orders.pending_count === 0 && (
                  <span className="text-xs text-muted-foreground">Inga ordrar ännu</span>
                )}
              </div>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-xs font-medium text-muted-foreground uppercase cursor-help flex items-center gap-1">
                      Konvertering <HelpCircle className="w-3 h-3" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent><p className="text-xs max-w-[220px]">Andel som slutför köp av de som påbörjar checkout. Misslyckade och avbrutna exkluderas.</p></TooltipContent>
                </Tooltip>
                <Target className="w-4 h-4 text-muted-foreground" />
              </div>
              {analytics.checkout_starts > 0 ? (
                <>
                  <p className={`text-2xl font-bold ${conversionRate >= 50 ? 'text-green-600' : conversionRate > 0 ? 'text-yellow-600' : ''}`}>
                    {conversionRate}%
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {analytics.checkout_completes} av {analytics.checkout_starts} checkout
                  </p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-bold text-muted-foreground">–</p>
                  <p className="text-xs text-muted-foreground mt-1">Ingen checkout-data ännu</p>
                </>
              )}
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground uppercase">Snittorder</span>
                <BarChart3 className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold">{orders.paid_count > 0 ? fmt(Math.round(orders.avg_order)) : '–'}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {orders.paid_count > 0 ? `Median: ${fmt(Math.round(orders.median_order))}` : 'Ingen orderdata ännu'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Secondary stats row */}
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
          <Card className="border-border">
            <CardContent className="pt-4 pb-3 text-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="cursor-help">
                    <Eye className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
                    <p className="text-xl font-bold">{noData(analytics.product_views)}</p>
                    <p className="text-[11px] text-muted-foreground">Produktvisningar</p>
                  </div>
                </TooltipTrigger>
                <TooltipContent><p className="text-xs">Antal gånger en produktsida öppnats ({periodLabel})</p></TooltipContent>
              </Tooltip>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="pt-4 pb-3 text-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="cursor-help">
                    <Search className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
                    <p className="text-xl font-bold">{noData(searches.total_searches)}</p>
                    <p className="text-[11px] text-muted-foreground">Sökningar</p>
                  </div>
                </TooltipTrigger>
                <TooltipContent><p className="text-xs">Antal sökningar i butiken ({periodLabel})</p></TooltipContent>
              </Tooltip>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="pt-4 pb-3 text-center">
              <Plus className="w-4 h-4 mx-auto text-green-600 mb-1" />
              <p className="text-xl font-bold">{noData(analytics.cart_adds)}</p>
              <p className="text-[11px] text-muted-foreground">Lagt i vagn</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="pt-4 pb-3 text-center">
              <Minus className="w-4 h-4 mx-auto text-destructive mb-1" />
              <p className="text-xl font-bold">{noData(analytics.cart_removes)}</p>
              <p className="text-[11px] text-muted-foreground">Borttagna</p>
            </CardContent>
          </Card>
          <Card className={`border-border ${analytics.checkout_abandons > 0 ? 'border-destructive/20' : ''}`}>
            <CardContent className="pt-4 pb-3 text-center">
              <LogOut className={`w-4 h-4 mx-auto mb-1 ${analytics.checkout_abandons > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
              <p className={`text-xl font-bold ${analytics.checkout_abandons > 0 ? 'text-destructive' : ''}`}>{noData(analytics.checkout_abandons)}</p>
              <p className="text-[11px] text-muted-foreground">Övergivna</p>
            </CardContent>
          </Card>
          <Card className={`border-border ${orders.refunded_count > 0 ? 'border-yellow-400/20' : ''}`}>
            <CardContent className="pt-4 pb-3 text-center">
              <Ban className={`w-4 h-4 mx-auto mb-1 ${orders.refunded_count > 0 ? 'text-yellow-600' : 'text-muted-foreground'}`} />
              <p className={`text-xl font-bold ${orders.refunded_count > 0 ? 'text-yellow-600' : ''}`}>{noData(orders.refunded_count)}</p>
              <p className="text-[11px] text-muted-foreground">Returnerade</p>
            </CardContent>
          </Card>
        </div>
      </TooltipProvider>

      {/* ─── Activity log summary ─── */}
      {(() => {
        const errorLogs = recentLogs.filter(l => l.log_type === 'error');
        const warningLogs = recentLogs.filter(l => l.log_type === 'warning');
        const securityLogs = recentLogs.filter(l => l.category === 'security');

        return (
          <Card className="border-border">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <div className="relative">
                    <Activity className="w-4 h-4 text-primary" />
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  </div>
                  Aktivitet
                  <div className="flex gap-1.5 ml-2">
                    {errorLogs.length > 0 && (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">{errorLogs.length} fel</Badge>
                    )}
                    {warningLogs.length > 0 && (
                      <Badge className="text-[10px] px-1.5 py-0 bg-yellow-500/10 text-yellow-700 border-yellow-400/30">{warningLogs.length} varningar</Badge>
                    )}
                    {securityLogs.length > 0 && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{securityLogs.length} säkerhet</Badge>
                    )}
                  </div>
                </CardTitle>
                <Link to="/admin/logs" className="text-xs text-primary hover:underline flex items-center gap-1">
                  Visa alla <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {recentLogs.length === 0 ? (
                  <EmptyState icon={Activity} message="Inga loggposter ännu" />
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
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* ─── Tabs ─── */}
      <Tabs defaultValue="checkout" className="space-y-4">
        <TabsList className="bg-secondary/50 flex-wrap">
          <TabsTrigger value="checkout">💳 Checkout</TabsTrigger>
          <TabsTrigger value="cart">🛒 Kundvagn</TabsTrigger>
          <TabsTrigger value="abandoned">
            🚪 Övergivna
            {abandonedItems.length > 0 && (
              <Badge variant="destructive" className="ml-1.5 text-[10px] px-1.5 py-0">{abandonedItems.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="searches">📈 Sökningar</TabsTrigger>
          <TabsTrigger value="demand">
            💡 Efterfrågan
            {demandSearches.length > 0 && (
              <Badge variant="destructive" className="ml-1.5 text-[10px] px-1.5 py-0">{demandSearches.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="views">👁 Visningar</TabsTrigger>
          <TabsTrigger value="orders">🧾 Ordrar</TabsTrigger>
          {isFounder && <TabsTrigger value="settings">⚙️ Hantera</TabsTrigger>}
        </TabsList>

        {/* ─── Checkout Tab ─── */}
        <TabsContent value="checkout">
          <div className="space-y-4">
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-primary" /> Checkout-tratt
                </CardTitle>
                <p className="text-sm text-muted-foreground">Start → Köp → Avbruten ({periodLabel})</p>
              </CardHeader>
              <CardContent className="space-y-6">
                {analytics.checkout_starts === 0 ? (
                  <EmptyState icon={ShoppingCart} message="Inga checkout-händelser ännu" />
                ) : (
                  <>
                    <div className="space-y-3">
                      {[
                        { label: 'Påbörjad', value: analytics.checkout_starts, total: analytics.checkout_starts, color: 'bg-primary/60' },
                        { label: 'Genomförd', value: analytics.checkout_completes, total: analytics.checkout_starts, color: 'bg-green-500/60' },
                        { label: 'Avbrutna', value: analytics.checkout_abandons, total: analytics.checkout_starts, color: 'bg-destructive/50' },
                      ].map(bar => (
                        <div key={bar.label}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">{bar.label}</span>
                            <span className={`text-sm font-bold ${bar.label === 'Avbrutna' && bar.value > 0 ? 'text-destructive' : ''}`}>{bar.value}</span>
                          </div>
                          <div className="h-8 rounded-lg bg-secondary/50 overflow-hidden">
                            <div className={`h-full ${bar.color} rounded-lg`} style={{ width: `${(bar.value / bar.total) * 100}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="p-4 rounded-xl bg-secondary/50 text-center">
                        <p className={`text-2xl font-bold ${conversionRate >= 50 ? 'text-green-600' : 'text-primary'}`}>{conversionRate}%</p>
                        <p className="text-xs text-muted-foreground mt-1">Konvertering</p>
                      </div>
                      <div className="p-4 rounded-xl bg-secondary/50 text-center">
                        <p className={`text-2xl font-bold ${analytics.checkout_starts > 0 && conversionRate < 50 ? 'text-destructive' : ''}`}>
                          {analytics.checkout_starts > 0 ? 100 - conversionRate : 0}%
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">Drop-off</p>
                      </div>
                      <div className="p-4 rounded-xl bg-secondary/50 text-center">
                        <p className="text-2xl font-bold">{analytics.checkout_starts}</p>
                        <p className="text-xs text-muted-foreground mt-1">Checkout-besök</p>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── Cart Tab ─── */}
        <TabsContent value="cart">
          <div className="grid lg:grid-cols-2 gap-4">
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Plus className="w-5 h-5 text-green-600" /> Lagt i kundvagn
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {cartAdds.map((item, idx) => (
                    <div key={item.title} className="flex items-center justify-between p-3 rounded-xl bg-secondary/50">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-green-500/10 flex items-center justify-center text-xs font-bold text-green-600">{idx + 1}</div>
                        <span className="font-medium text-sm">{item.title}</span>
                      </div>
                      <Badge variant="outline">{item.count} st</Badge>
                    </div>
                  ))}
                  {cartAdds.length === 0 && <EmptyState icon={ShoppingCart} message="Ingen data ännu" />}
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
                  {cartRemoves.length === 0 && <EmptyState icon={CheckCircle} message="Inga borttagningar — bra!" />}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── Abandoned Tab ─── */}
        <TabsContent value="abandoned">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <LogOut className="w-5 h-5 text-destructive" /> Övergivna produkter i kassan
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Produkter kunder hade i kassan när de lämnade ({periodLabel})
              </p>
            </CardHeader>
            <CardContent>
              {abandonedItems.length > 0 && (
                <div className="mb-4 p-3 rounded-lg bg-destructive/5 border border-destructive/10">
                  <p className="text-sm font-medium text-destructive">
                    Totalt förlorat värde: {fmt(abandonedItems.reduce((s, i) => s + i.totalValue, 0))}
                  </p>
                </div>
              )}
              <div className="space-y-2">
                {abandonedItems.map((item, idx) => (
                  <div key={item.title} className="flex items-center justify-between p-3 rounded-xl bg-destructive/5 border border-destructive/10">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-destructive/10 flex items-center justify-center text-xs font-bold text-destructive">{idx + 1}</div>
                      <div>
                        <span className="font-medium text-sm">{item.title}</span>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Förlorat: {fmt(item.totalValue)}
                        </p>
                      </div>
                    </div>
                    <Badge className="bg-destructive/10 text-destructive border-0 font-bold">{item.count} st</Badge>
                  </div>
                ))}
                {abandonedItems.length === 0 && <EmptyState icon={CheckCircle} message="Inga övergivna kassor ännu" />}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Searches Tab ─── */}
        <TabsContent value="searches">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Search className="w-5 h-5 text-primary" /> Sökningar ({periodLabel})
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {searches.total_searches} totalt · {searches.with_results} med resultat · {searches.without_results} utan
              </p>
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
                      <Badge variant="outline">{s.count}×</Badge>
                      <Badge className="bg-green-500/10 text-green-700 border-0">{s.results_count} träffar</Badge>
                    </div>
                  </div>
                ))}
                {searchesWithProducts.length === 0 && <EmptyState icon={Search} message="Inga sökningar ännu" />}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Demand Tab ─── */}
        <TabsContent value="demand">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-yellow-500" /> Efterfrågade produkter
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Sökningar som <strong>inte gav resultat</strong> — potential för nya produkter
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
                {demandSearches.length === 0 && <EmptyState icon={CheckCircle} message="Alla sökningar har hittat produkter — bra jobbat!" />}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Views Tab ─── */}
        <TabsContent value="views">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Eye className="w-5 h-5 text-primary" /> Mest visade produkter ({periodLabel})
              </CardTitle>
            </CardHeader>
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
                {productViews.length === 0 && <EmptyState icon={Eye} message="Ingen visningsdata ännu" />}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Orders Tab ─── */}
        <TabsContent value="orders">
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Card className="border-border">
                <CardContent className="pt-4 pb-3 text-center">
                  <DollarSign className="w-4 h-4 mx-auto text-green-600 mb-1" />
                  <p className="text-xl font-bold text-green-600">{fmt(orders.total_revenue)}</p>
                  <p className="text-xs text-muted-foreground">Netto</p>
                </CardContent>
              </Card>
              <Card className="border-border">
                <CardContent className="pt-4 pb-3 text-center">
                  <TrendingUp className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
                  <p className="text-xl font-bold">{fmt(orders.gross_revenue)}</p>
                  <p className="text-xs text-muted-foreground">Brutto</p>
                </CardContent>
              </Card>
              <Card className="border-border">
                <CardContent className="pt-4 pb-3 text-center">
                  <Target className="w-4 h-4 mx-auto text-primary mb-1" />
                  <p className="text-xl font-bold">{fmt(Math.round(orders.avg_order))}</p>
                  <p className="text-xs text-muted-foreground">Snitt</p>
                </CardContent>
              </Card>
              <Card className="border-border">
                <CardContent className="pt-4 pb-3 text-center">
                  <BarChart3 className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
                  <p className="text-xl font-bold">{fmt(Math.round(orders.median_order))}</p>
                  <p className="text-xs text-muted-foreground">Median</p>
                </CardContent>
              </Card>
            </div>

            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-lg font-semibold">Orderfördelning</CardTitle>
                <p className="text-sm text-muted-foreground">Betalda ordrar per prisintervall ({periodLabel})</p>
              </CardHeader>
              <CardContent className="space-y-2">
                {orders.ranges && orders.ranges.length > 0 ? orders.ranges.map((r: any) => {
                  const maxCount = Math.max(...orders.ranges.map((x: any) => x.count), 1);
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
                      <span className="text-xs text-muted-foreground w-12 text-right">
                        {orders.paid_count > 0 ? Math.round((r.count / orders.paid_count) * 100) : 0}%
                      </span>
                    </div>
                  );
                }) : (
                  <EmptyState icon={BarChart3} message="Inga betalda ordrar ännu" />
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── Founder Settings Tab ─── */}
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
                      <TrendingUp className="w-4 h-4 text-green-600" />
                      <h4 className="font-medium text-sm">Försäljningsdata</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">product_sales-tabellen</p>
                    <ConfirmClearButton onConfirm={handleClearProductSales} label="Rensa allt" />
                  </div>

                  <div className="p-4 rounded-xl border border-border bg-secondary/20 space-y-3">
                    <div className="flex items-center gap-2">
                      <Search className="w-4 h-4 text-primary" />
                      <h4 className="font-medium text-sm">Sökloggar</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">search_logs-tabellen</p>
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
