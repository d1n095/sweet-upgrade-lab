import { useState, useEffect, useMemo } from 'react';
import {
  Package, ClipboardList, Users, Star, TrendingUp, AlertTriangle,
  DollarSign, ShoppingCart, Plus, Power, ArrowRight, Clock,
  Zap, CheckCircle2, ChevronRight, Loader2, Flame,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Link, useNavigate } from 'react-router-dom';
import { useStoreSettings } from '@/stores/storeSettingsStore';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

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

interface FocusWorkItem {
  id: string;
  title: string;
  priority: string;
  item_type: string;
  status: string;
  due_at: string | null;
  related_order_id: string | null;
  source_type: string | null;
}

const statusColors: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  confirmed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  processing: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  shipped: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  delivered: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
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
    aov: 0, conversionRate: 0,
  });
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [lowStockItems, setLowStockItems] = useState<LowStockProduct[]>([]);
  const [focusItems, setFocusItems] = useState<FocusWorkItem[]>([]);
  const [ordersToPack, setOrdersToPack] = useState(0);

  const load = async () => {
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [products, orders, todayOrders, members, reviews, workItems, packOrders, analytics] = await Promise.all([
        supabase.from('products').select('id, title_sv, stock, reserved_stock, allow_overselling'),
        supabase.from('orders').select('id, status, total_amount, payment_status').is('deleted_at', null),
        supabase.from('orders').select('id, total_amount, payment_status').is('deleted_at', null).gte('created_at', todayStart.toISOString()),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_member', true),
        supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('is_approved', false),
        supabase.from('work_items' as any).select('id, title, priority, item_type, status, due_at, related_order_id, source_type')
          .neq('status', 'done').neq('status', 'cancelled').order('created_at', { ascending: false }).limit(10),
        supabase.from('orders').select('id', { count: 'exact', head: true }).is('deleted_at', null).eq('payment_status', 'paid').in('fulfillment_status', ['pending', 'unfulfilled']),
        supabase.from('analytics_events').select('event_type').in('event_type', ['product_view', 'checkout_start', 'checkout_complete']).gte('created_at', thirtyDaysAgo.toISOString()),
      ]);

      const prods = products.data || [];
      const ords = orders.data || [];
      const todayOrdsList = todayOrders.data || [];
      const lowStock = prods.filter(p => !p.allow_overselling && p.stock <= 5 && p.stock >= 0);
      const paidOrders = ords.filter(o => o.payment_status === 'paid');
      const revenueToday = todayOrdsList.filter(o => o.payment_status === 'paid').reduce((sum, o) => sum + (o.total_amount || 0), 0);
      const aov = paidOrders.length > 0 ? paidOrders.reduce((s, o) => s + (o.total_amount || 0), 0) / paidOrders.length : 0;

      const events = analytics.data || [];
      const views = events.filter(e => e.event_type === 'product_view').length;
      const completes = events.filter(e => e.event_type === 'checkout_complete').length;
      const conversionRate = views > 0 ? Math.round((completes / views) * 100) : 0;

      setStats({
        totalProducts: prods.length,
        lowStockProducts: lowStock.length,
        totalOrders: ords.length,
        pendingOrders: ords.filter(o => o.status === 'pending').length,
        totalMembers: members.count || 0,
        pendingReviews: reviews.count || 0,
        ordersToday: todayOrdsList.length,
        revenueToday,
        aov,
        conversionRate,
      });

      setLowStockItems(lowStock.slice(0, 5) as LowStockProduct[]);
      const allWorkItems = (workItems.data || []) as unknown as FocusWorkItem[];
      setFocusItems(allWorkItems);
      setOrdersToPack(packOrders.count || 0);

      const { data: recent } = await supabase
        .from('orders')
        .select('id, order_email, total_amount, status, payment_status, fulfillment_status, created_at, order_number, payment_intent_id')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(8);
      setRecentOrders((recent || []) as RecentOrder[]);
    } catch (e) {
      console.error('Failed to load dashboard:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel('dashboard-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_items' }, () => load())
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

  const actionItems = useMemo(() => {
    const items: { label: string; desc: string; href: string; icon: any; color: string; bg: string }[] = [];
    const escalatedItems = focusItems.filter(i => i.status === 'escalated' || i.priority === 'critical');
    if (escalatedItems.length > 0) items.push({ label: 'Lös eskalerat ärende', desc: escalatedItems[0].title, href: '/admin/staff', icon: AlertTriangle, color: 'text-destructive', bg: 'bg-destructive/10' });
    const highItems = focusItems.filter(t => t.priority === 'high');
    if (highItems.length > 0) items.push({ label: `${highItems.length} hög prioritet`, desc: highItems[0].title, href: '/admin/staff', icon: Zap, color: 'text-orange-600', bg: 'bg-orange-500/10' });
    const bugItems = focusItems.filter(t => t.item_type === 'bug');
    if (bugItems.length > 0) items.push({ label: `${bugItems.length} öppna buggar`, desc: bugItems[0].title, href: '/admin/staff', icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-500/10' });
    if (ordersToPack > 0) items.push({ label: `Packa ${ordersToPack} order`, desc: 'Väntar på packning', href: '/admin/orders', icon: Package, color: 'text-blue-600', bg: 'bg-blue-500/10' });
    if (stats.lowStockProducts > 0) items.push({ label: `${stats.lowStockProducts} lågt lager`, desc: 'Kontrollera lagerstatus', href: '/admin/products', icon: Package, color: 'text-amber-600', bg: 'bg-amber-500/10' });
    if (stats.pendingReviews > 0) items.push({ label: 'Granska recensioner', desc: `${stats.pendingReviews} väntande`, href: '/admin/communication', icon: Star, color: 'text-yellow-600', bg: 'bg-yellow-500/10' });
    if (stats.conversionRate > 0 && stats.conversionRate < 30) items.push({ label: 'Låg konvertering', desc: `${stats.conversionRate}% — kontrollera checkout-flödet`, href: '/admin/stats', icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-500/10' });
    return items;
  }, [focusItems, ordersToPack, stats.pendingReviews, stats.lowStockProducts, stats.conversionRate]);

  const recommended = actionItems[0] || { label: 'Allt under kontroll', desc: 'Inga brådskande uppgifter', href: '#', icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-500/10' };

  const topCards = [
    { title: 'Intäkter idag', value: fmt(stats.revenueToday), icon: DollarSign, color: 'text-green-600', bg: 'bg-green-500/10', href: '/admin/stats' },
    { title: 'Ordrar idag', value: stats.ordersToday, icon: ShoppingCart, color: 'text-blue-600', bg: 'bg-blue-500/10', href: '/admin/stats' },
    { title: 'Konvertering (30d)', value: `${stats.conversionRate}%`, icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-500/10', href: '/admin/stats' },
    { title: 'AOV', value: fmt(stats.aov), icon: DollarSign, color: 'text-amber-600', bg: 'bg-amber-500/10', href: '/admin/stats' },
  ];

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm">Snabb översikt</p>
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

      {/* Recommended Actions Panel */}
      <Card className="border-border">
        <CardContent className="pt-4 pb-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Rekommenderade åtgärder</p>
          {actionItems.length === 0 ? (
            <div className="flex items-center gap-3 p-2">
              <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
              </div>
              <p className="text-sm text-muted-foreground">Allt under kontroll — inga brådskande uppgifter</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {actionItems.slice(0, 4).map((item, i) => (
                <button
                  key={i}
                  onClick={() => navigate(item.href)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-secondary/50 transition-colors text-left group"
                >
                  <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', item.bg)}>
                    <item.icon className={cn('w-4 h-4', item.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground truncate">{item.desc}</p>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* KPI Cards → click opens Statistics */}
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
              <p className="text-2xl font-bold tabular-nums">{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Orders + Alerts side by side */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Orders Table */}
        <Card className="border-border lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Senaste ordrar</CardTitle>
              <Link to="/admin/orders" className="text-xs text-primary hover:underline flex items-center gap-1">
                Alla ordrar <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentOrders.length === 0 ? (
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
                        <td className="py-2.5 px-2 text-right text-muted-foreground text-xs">{formatTime(order.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Alerts Panel */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              Varningar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {focusItems.filter(i => i.status === 'escalated' || i.priority === 'critical').length === 0 && focusItems.filter(t => t.priority === 'high').length === 0 && stats.lowStockProducts === 0 ? (
              <div className="flex flex-col items-center py-4 text-center">
                <CheckCircle2 className="w-7 h-7 text-green-500/50 mb-1.5" />
                <p className="text-xs text-muted-foreground">Inga aktiva varningar</p>
              </div>
            ) : (
              <>
                {focusItems.filter(i => i.status === 'escalated' || i.priority === 'critical').map(item => (
                  <button key={item.id} onClick={() => navigate('/admin/staff')} className="w-full flex items-center gap-2 p-2 rounded-md bg-destructive/5 hover:bg-destructive/10 transition-colors text-left">
                    <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />
                    <span className="text-xs truncate flex-1">{item.title}</span>
                    <Badge variant="destructive" className="text-[9px]">{item.item_type === 'incident' ? 'SLA' : 'KRIT'}</Badge>
                  </button>
                ))}
                {focusItems.filter(t => t.priority === 'high' && t.status !== 'escalated').map(item => (
                  <button key={item.id} onClick={() => navigate('/admin/staff')} className="w-full flex items-center gap-2 p-2 rounded-md bg-orange-500/5 hover:bg-orange-500/10 transition-colors text-left">
                    <Zap className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                    <span className="text-xs truncate flex-1">{item.title}</span>
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
      </div>

      {/* Bottom: Low stock items */}
      {lowStockItems.length > 0 && (
        <Card className="border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-500" />
                Lågt lager
              </CardTitle>
              <Link to="/admin/products" className="text-xs text-primary hover:underline">Visa alla</Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {lowStockItems.map((product) => (
                <div key={product.id} className="flex items-center justify-between p-2 rounded-md bg-secondary/30">
                  <p className="text-xs font-medium truncate flex-1">{product.title_sv}</p>
                  <Badge variant={product.stock === 0 ? 'destructive' : 'outline'} className={cn('text-[10px] ml-2', product.stock > 0 ? 'border-amber-400 text-amber-600' : '')}>
                    {product.stock} st
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: `${stats.totalMembers} medlemmar`, icon: Users, href: '/admin/members' },
          { label: `${stats.pendingReviews} recensioner`, icon: Star, href: '/admin/communication' },
          { label: `${stats.totalProducts} produkter`, icon: Package, href: '/admin/products' },
          { label: 'Statistik →', icon: TrendingUp, href: '/admin/stats' },
        ].map((item) => (
          <Link key={item.label} to={item.href}>
            <Card className="border-border hover:border-primary/30 transition-colors cursor-pointer">
              <CardContent className="pt-3 pb-2.5">
                <div className="flex items-center gap-2">
                  <item.icon className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium">{item.label}</span>
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
