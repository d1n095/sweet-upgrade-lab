import { useState, useEffect, lazy, Suspense, useMemo } from 'react';
import {
  Package, ClipboardList, Users, Star, TrendingUp, AlertTriangle,
  DollarSign, ShoppingCart, Plus, Eye, Power, ArrowRight, Clock,
  Zap, CheckCircle2, PlayCircle, ChevronRight, Loader2, Flame,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Link, useNavigate } from 'react-router-dom';
import { useStoreSettings } from '@/stores/storeSettingsStore';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

const AdminDashboardCharts = lazy(() => import('@/components/admin/AdminDashboardCharts'));

interface RecentOrder {
  id: string;
  order_email: string;
  total_amount: number;
  status: string;
  payment_status: string;
  fulfillment_status: string;
  created_at: string;
  order_number: string | null;
  payment_intent_id: string | null;
}

interface LowStockProduct {
  id: string;
  title_sv: string;
  stock: number;
  reserved_stock: number;
}

interface FocusTask {
  id: string;
  title: string;
  priority: string;
  task_type: string;
  status: string;
  due_at: string | null;
  related_order_id: string | null;
}

interface FocusIncident {
  id: string;
  title: string;
  priority: string;
  sla_status: string;
  sla_deadline: string | null;
  order_id: string;
  status: string;
}

interface TopProduct {
  id: string;
  title_sv: string;
  units_sold_30d: number;
  stock: number;
  price: number;
}

const statusColors: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  confirmed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  processing: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  shipped: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  delivered: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-destructive/10 text-destructive border-destructive/20',
  medium: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20',
  low: 'bg-green-500/10 text-green-700 border-green-500/20',
};

const fulfillmentBadge: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  packed: 'bg-blue-100 text-blue-700',
  shipped: 'bg-cyan-100 text-cyan-700',
  delivered: 'bg-green-100 text-green-700',
};

const AdminOverview = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { siteActive, setSiteActive } = useStoreSettings();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalProducts: 0, lowStockProducts: 0, totalOrders: 0, pendingOrders: 0,
    totalMembers: 0, pendingReviews: 0, ordersToday: 0, revenueToday: 0,
  });
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [lowStockItems, setLowStockItems] = useState<LowStockProduct[]>([]);
  const [focusTasks, setFocusTasks] = useState<FocusTask[]>([]);
  const [focusIncidents, setFocusIncidents] = useState<FocusIncident[]>([]);
  const [ordersToPack, setOrdersToPack] = useState(0);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [funnelData, setFunnelData] = useState({ views: 0, carts: 0, checkouts: 0, purchases: 0 });

  const load = async () => {
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [products, orders, todayOrders, members, reviews, tasks, incidents, packOrders, analytics] = await Promise.all([
        supabase.from('products').select('id, title_sv, stock, reserved_stock, allow_overselling, units_sold_30d, price'),
        supabase.from('orders').select('id, status, total_amount, payment_status').is('deleted_at', null),
        supabase.from('orders').select('id, total_amount, payment_status').is('deleted_at', null).gte('created_at', todayStart.toISOString()),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_member', true),
        supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('is_approved', false),
        supabase.from('staff_tasks').select('id, title, priority, task_type, status, due_at, related_order_id')
          .neq('status', 'done').neq('status', 'cancelled').order('created_at', { ascending: false }).limit(5),
        supabase.from('order_incidents').select('id, title, priority, sla_status, sla_deadline, order_id, status')
          .neq('status', 'resolved').neq('status', 'closed').order('created_at', { ascending: false }).limit(5),
        supabase.from('orders').select('id', { count: 'exact', head: true }).is('deleted_at', null).eq('payment_status', 'paid').in('fulfillment_status', ['pending', 'unfulfilled']),
        supabase.from('analytics_events').select('event_type').in('event_type', ['product_view', 'add_to_cart', 'checkout_start', 'checkout_complete']).gte('created_at', thirtyDaysAgo.toISOString()),
      ]);

      const prods = products.data || [];
      const ords = orders.data || [];
      const todayOrdsList = todayOrders.data || [];
      const lowStock = prods.filter(p => !p.allow_overselling && p.stock <= 5 && p.stock >= 0);

      // Top products by 30d sales
      const sorted = [...prods].sort((a, b) => (b.units_sold_30d || 0) - (a.units_sold_30d || 0));
      setTopProducts(sorted.slice(0, 5) as TopProduct[]);

      // Funnel data
      const events = analytics.data || [];
      setFunnelData({
        views: events.filter(e => e.event_type === 'product_view').length,
        carts: events.filter(e => e.event_type === 'add_to_cart').length,
        checkouts: events.filter(e => e.event_type === 'checkout_start').length,
        purchases: events.filter(e => e.event_type === 'checkout_complete').length,
      });

      setStats({
        totalProducts: prods.length,
        lowStockProducts: lowStock.length,
        totalOrders: ords.length,
        pendingOrders: ords.filter(o => o.status === 'pending').length,
        totalMembers: members.count || 0,
        pendingReviews: reviews.count || 0,
        ordersToday: todayOrdsList.length,
        revenueToday: todayOrdsList.filter(o => o.payment_status === 'paid').reduce((sum, o) => sum + (o.total_amount || 0), 0),
      });

      setLowStockItems(lowStock.slice(0, 5) as LowStockProduct[]);
      setFocusTasks((tasks.data || []) as FocusTask[]);
      setFocusIncidents((incidents.data || []) as FocusIncident[]);
      setOrdersToPack(packOrders.count || 0);

      const { data: recent } = await supabase
        .from('orders')
        .select('id, order_email, total_amount, status, payment_status, fulfillment_status, created_at, order_number, payment_intent_id')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(10);
      setRecentOrders((recent || []) as RecentOrder[]);
    } catch (e) {
      console.error('Failed to load admin stats:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel('dashboard-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_tasks' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fmt = (n: number) => new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', minimumFractionDigits: 0 }).format(n);

  const formatTime = (dateStr: string) => {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Just nu';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return new Date(dateStr).toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' });
  };

  const recommended = useMemo(() => {
    const overdueInc = focusIncidents.filter(i => i.sla_status === 'overdue');
    if (overdueInc.length > 0) return { label: 'Lös försenat ärende', desc: overdueInc[0].title, href: '/admin/orders', icon: AlertTriangle, color: 'text-destructive' };
    const highTasks = focusTasks.filter(t => t.priority === 'high');
    if (highTasks.length > 0) return { label: 'Hög prioritet', desc: highTasks[0].title, href: '/admin/staff', icon: Zap, color: 'text-orange-600' };
    if (ordersToPack > 0) return { label: `Packa ${ordersToPack} order`, desc: 'Väntar på packning', href: '/admin/orders', icon: Package, color: 'text-blue-600' };
    if (stats.pendingReviews > 0) return { label: 'Granska recensioner', desc: `${stats.pendingReviews} väntande`, href: '/admin/communication', icon: Star, color: 'text-yellow-600' };
    return { label: 'Allt under kontroll', desc: 'Inga brådskande uppgifter', href: '#', icon: CheckCircle2, color: 'text-green-600' };
  }, [focusIncidents, focusTasks, ordersToPack, stats.pendingReviews]);

  const topCards = [
    { title: 'Ordrar idag', value: stats.ordersToday, icon: ShoppingCart, color: 'text-blue-600', bg: 'bg-blue-500/10', href: '/admin/orders' },
    { title: 'Intäkter idag', value: fmt(stats.revenueToday), icon: DollarSign, color: 'text-green-600', bg: 'bg-green-500/10', href: '/admin/finance' },
    { title: 'Att packa', value: ordersToPack, icon: Package, color: 'text-amber-600', bg: 'bg-amber-500/10', href: '/admin/ops' },
    { title: 'Produkter', value: stats.totalProducts, icon: Package, color: 'text-primary', bg: 'bg-primary/10', href: '/admin/products' },
  ];

  // Funnel helpers
  const funnelSteps = [
    { label: 'Besök', value: funnelData.views, color: 'bg-blue-500' },
    { label: 'Kundvagn', value: funnelData.carts, color: 'bg-purple-500' },
    { label: 'Checkout', value: funnelData.checkouts, color: 'bg-amber-500' },
    { label: 'Köp', value: funnelData.purchases, color: 'bg-green-500' },
  ];
  const funnelMax = Math.max(funnelData.views, 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm">Översikt av din butik</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" className="gap-1.5" onClick={() => navigate('/admin/products')}>
            <Plus className="w-3.5 h-3.5" /> Ny produkt
          </Button>
          <Button
            size="sm"
            variant={siteActive ? 'outline' : 'destructive'}
            className="gap-1.5"
            onClick={() => setSiteActive(!siteActive)}
          >
            <Power className="w-3.5 h-3.5" />
            {siteActive ? 'Stäng' : 'Öppna'}
          </Button>
        </div>
      </div>

      {/* 🔥 Focus action */}
      <button
        onClick={() => recommended.href !== '#' && navigate(recommended.href)}
        className="w-full flex items-center gap-3 p-3 rounded-xl bg-primary/[0.03] border border-primary/10 hover:border-primary/30 hover:shadow-sm transition-all active:scale-[0.99] text-left"
      >
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
          recommended.color === 'text-destructive' ? 'bg-destructive/10' :
          recommended.color === 'text-orange-600' ? 'bg-orange-500/10' :
          recommended.color === 'text-blue-600' ? 'bg-blue-500/10' :
          recommended.color === 'text-yellow-600' ? 'bg-yellow-500/10' : 'bg-green-500/10'
        )}>
          <recommended.icon className={cn('w-5 h-5', recommended.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">👉 {recommended.label}</p>
          <p className="text-xs text-muted-foreground truncate">{recommended.desc}</p>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
      </button>

      {/* Row 1: KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {topCards.map((c) => (
          <Card
            key={c.title}
            className="border-border cursor-pointer hover:shadow-md hover:border-primary/20 transition-all active:scale-[0.97]"
            onClick={() => navigate(c.href)}
          >
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{c.title}</span>
                <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', c.bg)}>
                  <c.icon className={cn('w-3.5 h-3.5', c.color)} />
                </div>
              </div>
              <p className="text-2xl font-bold tabular-nums">{loading ? '–' : c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Row 2: Revenue Chart (70%) + Funnel (30%) */}
      <div className="grid lg:grid-cols-10 gap-4">
        <div className="lg:col-span-7">
          <Suspense fallback={<div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}>
            <AdminDashboardCharts />
          </Suspense>
        </div>

        {/* Conversion Funnel */}
        <Card className="lg:col-span-3 border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Konverteringstratt (30d)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {funnelSteps.map((step, i) => {
              const pct = funnelMax > 0 ? Math.round((step.value / funnelMax) * 100) : 0;
              const prevValue = i > 0 ? funnelSteps[i - 1].value : 0;
              const dropoff = i > 0 && prevValue > 0 ? Math.round(((prevValue - step.value) / prevValue) * 100) : 0;
              return (
                <div key={step.label}>
                  {i > 0 && (
                    <div className="flex items-center gap-1.5 ml-2 -mt-1 mb-1">
                      <div className="w-px h-3 bg-border" />
                      <span className="text-[10px] text-muted-foreground">↓ {dropoff}% tappas</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium">{step.label}</span>
                    <span className="tabular-nums font-semibold">{step.value.toLocaleString('sv-SE')}</span>
                  </div>
                  <div className="w-full h-2.5 bg-secondary rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full transition-all', step.color)} style={{ width: `${Math.max(pct, 2)}%` }} />
                  </div>
                </div>
              );
            })}
            {funnelData.views > 0 && (
              <div className="pt-2 border-t border-border">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Total konvertering</span>
                  <span className="font-bold text-green-600">{funnelData.views > 0 ? ((funnelData.purchases / funnelData.views) * 100).toFixed(1) : '0'}%</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Orders Table (full width) */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Senaste ordrar</CardTitle>
            <Link to="/admin/orders" className="text-xs text-primary hover:underline flex items-center gap-1">
              Alla ordrar <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : recentOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Inga ordrar ännu</p>
          ) : (
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-2 px-2 text-xs font-medium text-muted-foreground">Order</th>
                    <th className="pb-2 px-2 text-xs font-medium text-muted-foreground hidden sm:table-cell">Kund</th>
                    <th className="pb-2 px-2 text-xs font-medium text-muted-foreground">Belopp</th>
                    <th className="pb-2 px-2 text-xs font-medium text-muted-foreground">Status</th>
                    <th className="pb-2 px-2 text-xs font-medium text-muted-foreground hidden md:table-cell">Leverans</th>
                    <th className="pb-2 px-2 text-xs font-medium text-muted-foreground text-right">Tid</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => (
                    <tr key={order.id} onClick={() => navigate('/admin/orders')} className="border-b border-border/50 hover:bg-secondary/30 cursor-pointer transition-colors">
                      <td className="py-2.5 px-2 font-medium">
                        {order.order_number || (order.payment_intent_id ? '#' + order.payment_intent_id.slice(-6).toUpperCase() : '–')}
                      </td>
                      <td className="py-2.5 px-2 text-muted-foreground truncate max-w-[160px] hidden sm:table-cell">{order.order_email}</td>
                      <td className="py-2.5 px-2 font-semibold tabular-nums">{fmt(order.total_amount)}</td>
                      <td className="py-2.5 px-2">
                        <Badge variant="outline" className={cn('text-[10px]', statusColors[order.payment_status] || statusColors[order.status] || '')}>
                          {order.payment_status === 'paid' ? 'Betald' : order.payment_status === 'failed' ? 'Misslyckad' : order.status}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-2 hidden md:table-cell">
                        <Badge variant="outline" className={cn('text-[10px]', fulfillmentBadge[order.fulfillment_status] || '')}>
                          {order.fulfillment_status === 'pending' ? 'Ej packad' : order.fulfillment_status === 'packed' ? 'Packad' : order.fulfillment_status === 'shipped' ? 'Skickad' : order.fulfillment_status}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-2 text-right text-muted-foreground text-xs">{formatTime(order.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Row 4: Alerts | Top Products | Low Stock */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Alerts Panel */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              Varningar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {focusIncidents.length === 0 && focusTasks.filter(t => t.priority === 'high').length === 0 && stats.lowStockProducts === 0 ? (
              <div className="flex flex-col items-center py-4 text-center">
                <CheckCircle2 className="w-7 h-7 text-green-500/50 mb-1.5" />
                <p className="text-xs text-muted-foreground">Inga aktiva varningar</p>
              </div>
            ) : (
              <>
                {focusIncidents.filter(i => i.sla_status === 'overdue').map(inc => (
                  <button key={inc.id} onClick={() => navigate('/admin/orders')} className="w-full flex items-center gap-2 p-2 rounded-md bg-destructive/5 hover:bg-destructive/10 transition-colors text-left">
                    <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />
                    <span className="text-xs truncate flex-1">{inc.title}</span>
                    <Badge variant="destructive" className="text-[9px]">SLA</Badge>
                  </button>
                ))}
                {focusTasks.filter(t => t.priority === 'high').map(task => (
                  <button key={task.id} onClick={() => navigate('/admin/staff')} className="w-full flex items-center gap-2 p-2 rounded-md bg-orange-500/5 hover:bg-orange-500/10 transition-colors text-left">
                    <Zap className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                    <span className="text-xs truncate flex-1">{task.title}</span>
                    <Badge variant="outline" className="text-[9px] border-orange-400 text-orange-600">HÖG</Badge>
                  </button>
                ))}
                {stats.lowStockProducts > 0 && (
                  <button onClick={() => navigate('/admin/products')} className="w-full flex items-center gap-2 p-2 rounded-md bg-amber-500/5 hover:bg-amber-500/10 transition-colors text-left">
                    <Package className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span className="text-xs flex-1">{stats.lowStockProducts} produkter med lågt lager</span>
                  </button>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Top Products */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-500" />
              Toppsäljare (30d)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {topProducts.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Ingen försäljningsdata</p>
            ) : topProducts.map((p, i) => (
              <div key={p.id} className="flex items-center gap-2 p-1.5">
                <span className="text-xs font-bold text-muted-foreground w-4 text-right">{i + 1}.</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{p.title_sv}</p>
                  <p className="text-[10px] text-muted-foreground">{fmt(p.price)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-bold tabular-nums">{p.units_sold_30d} st</p>
                  <p className={cn('text-[10px]', p.stock <= 5 ? 'text-destructive' : 'text-muted-foreground')}>{p.stock} i lager</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Low Stock */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Lågt lager
              </CardTitle>
              <Link to="/admin/products" className="text-xs text-primary hover:underline">Visa alla</Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {lowStockItems.length === 0 ? (
              <div className="flex flex-col items-center py-4 text-center">
                <Package className="w-7 h-7 text-green-500/50 mb-1.5" />
                <p className="text-xs text-muted-foreground">Alla produkter OK 👍</p>
              </div>
            ) : lowStockItems.map((product) => (
              <div key={product.id} className="flex items-center justify-between p-2 rounded-md bg-secondary/30">
                <p className="text-xs font-medium truncate flex-1">{product.title_sv}</p>
                <Badge variant={product.stock === 0 ? 'destructive' : 'outline'} className={cn('text-[10px]', product.stock > 0 ? 'border-amber-400 text-amber-600' : '')}>
                  {product.stock} st
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Bottom summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: `${stats.totalMembers} medlemmar`, icon: Users, href: '/admin/members' },
          { label: `${stats.pendingReviews} recensioner`, icon: Star, href: '/admin/communication' },
          { label: `${stats.lowStockProducts} lågt lager`, icon: AlertTriangle, href: '/admin/products' },
          { label: `${stats.totalOrders} totalt ordrar`, icon: TrendingUp, href: '/admin/orders' },
        ].map((item) => (
          <Link key={item.label} to={item.href}>
            <Card className="border-border hover:border-primary/30 transition-colors cursor-pointer">
              <CardContent className="pt-3 pb-2.5">
                <div className="flex items-center gap-2">
                  <item.icon className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium">{loading ? '–' : item.label}</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default AdminOverview;
