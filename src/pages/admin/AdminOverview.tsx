import { useState, useEffect } from 'react';
import {
  Package, ClipboardList, Users, Star, TrendingUp, AlertTriangle,
  DollarSign, ShoppingCart, Plus, Eye, Power, ArrowRight, Clock,
  Zap, CheckCircle2, PlayCircle, Timer, ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Link, useNavigate } from 'react-router-dom';
import { useStoreSettings } from '@/stores/storeSettingsStore';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';

interface RecentOrder {
  id: string;
  order_email: string;
  total_amount: number;
  status: string;
  payment_status: string;
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

const AdminOverview = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { siteActive, checkoutEnabled, setSiteActive, setCheckoutEnabled } = useStoreSettings();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalProducts: 0,
    lowStockProducts: 0,
    totalOrders: 0,
    pendingOrders: 0,
    totalMembers: 0,
    pendingReviews: 0,
    ordersToday: 0,
    revenueToday: 0,
  });
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [lowStockItems, setLowStockItems] = useState<LowStockProduct[]>([]);
  const [focusTasks, setFocusTasks] = useState<FocusTask[]>([]);
  const [focusIncidents, setFocusIncidents] = useState<FocusIncident[]>([]);
  const [ordersToPack, setOrdersToPack] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const [products, orders, todayOrders, members, reviews, tasks, incidents, packOrders] = await Promise.all([
          supabase.from('products').select('id, title_sv, stock, reserved_stock, allow_overselling'),
          supabase.from('orders').select('id, status, total_amount, payment_status'),
          supabase.from('orders').select('id, total_amount, payment_status').gte('created_at', todayStart.toISOString()),
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_member', true),
          supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('is_approved', false),
          supabase.from('staff_tasks').select('id, title, priority, task_type, status, due_at, related_order_id')
            .neq('status', 'done').order('created_at', { ascending: false }).limit(5),
          supabase.from('order_incidents').select('id, title, priority, sla_status, sla_deadline, order_id, status')
            .neq('status', 'resolved').neq('status', 'closed').order('created_at', { ascending: false }).limit(5),
          supabase.from('orders').select('id', { count: 'exact', head: true }).eq('payment_status', 'paid').in('fulfillment_status', ['pending', 'unfulfilled']),
        ]);

        const prods = products.data || [];
        const ords = orders.data || [];
        const todayOrdsList = todayOrders.data || [];
        const lowStock = prods.filter(p => !p.allow_overselling && p.stock <= 5 && p.stock >= 0);

        setStats({
          totalProducts: prods.length,
          lowStockProducts: lowStock.length,
          totalOrders: ords.length,
          pendingOrders: ords.filter(o => o.status === 'pending').length,
          totalMembers: members.count || 0,
          pendingReviews: reviews.count || 0,
          ordersToday: todayOrdsList.length,
          revenueToday: todayOrdsList
            .filter(o => o.payment_status === 'paid')
            .reduce((sum, o) => sum + (o.total_amount || 0), 0),
        });

        setLowStockItems(lowStock.slice(0, 5) as LowStockProduct[]);
        setFocusTasks((tasks.data || []) as FocusTask[]);
        setFocusIncidents((incidents.data || []) as FocusIncident[]);
        setOrdersToPack(packOrders.count || 0);

        const { data: recent } = await supabase
          .from('orders')
          .select('id, order_email, total_amount, status, payment_status, created_at, order_number, payment_intent_id')
          .order('created_at', { ascending: false })
          .limit(5);
        setRecentOrders((recent || []) as RecentOrder[]);
      } catch (e) {
        console.error('Failed to load admin stats:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', minimumFractionDigits: 0 }).format(amount);

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just nu';
    if (diffMins < 60) return `${diffMins} min sedan`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h sedan`;
    return d.toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' });
  };

  // Compute recommended next action
  const getRecommendedAction = () => {
    const overdueIncidents = focusIncidents.filter(i => i.sla_status === 'overdue');
    if (overdueIncidents.length > 0) {
      return { label: 'Lös försenat ärende', desc: overdueIncidents[0].title, href: '/admin/orders', icon: AlertTriangle, color: 'text-destructive' };
    }
    const highTasks = focusTasks.filter(t => t.priority === 'high');
    if (highTasks.length > 0) {
      return { label: 'Hög prioritet uppgift', desc: highTasks[0].title, href: '/admin/staff', icon: Zap, color: 'text-orange-600' };
    }
    if (ordersToPack > 0) {
      return { label: `Packa ${ordersToPack} order(s)`, desc: 'Orders väntar på packning', href: '/admin/orders', icon: Package, color: 'text-blue-600' };
    }
    if (stats.pendingReviews > 0) {
      return { label: 'Granska recensioner', desc: `${stats.pendingReviews} väntande`, href: '/admin/communication', icon: Star, color: 'text-yellow-600' };
    }
    return { label: 'Allt under kontroll', desc: 'Inga brådskande uppgifter', href: '#', icon: CheckCircle2, color: 'text-green-600' };
  };

  const recommended = getRecommendedAction();

  const topCards = [
    { title: 'Ordrar idag', value: stats.ordersToday, icon: ShoppingCart, color: 'text-blue-600', bgColor: 'bg-blue-500/10', href: '/admin/orders' },
    { title: 'Intäkter idag', value: formatCurrency(stats.revenueToday), icon: DollarSign, color: 'text-green-600', bgColor: 'bg-green-500/10', href: '/admin/finance' },
    { title: 'Väntande ordrar', value: stats.pendingOrders, icon: Clock, color: 'text-amber-600', bgColor: 'bg-amber-500/10', href: '/admin/orders' },
    { title: 'Produkter', value: stats.totalProducts, icon: Package, color: 'text-primary', bgColor: 'bg-primary/10', href: '/admin/products' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Översikt av din butik</p>
        </div>
      </div>

      {/* 🔥 DAGENS FOKUS */}
      <Card className="border-primary/20 bg-primary/[0.02]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            Dagens fokus
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Recommended next action */}
          <button
            onClick={() => recommended.href !== '#' && navigate(recommended.href)}
            className="w-full flex items-center gap-3 p-3 rounded-lg bg-background border border-border hover:border-primary/30 hover:shadow-sm transition-all active:scale-[0.98] text-left"
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

          {/* Focus summary row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button onClick={() => navigate('/admin/orders?tab=to_pack')} className="flex items-center gap-2 p-2.5 rounded-lg bg-background border border-border hover:border-primary/20 transition-colors text-left">
              <Package className="w-4 h-4 text-orange-600 shrink-0" />
              <div>
                <p className="text-lg font-bold leading-none">{loading ? '–' : ordersToPack}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Att packa</p>
              </div>
            </button>
            <button onClick={() => navigate('/admin/staff')} className="flex items-center gap-2 p-2.5 rounded-lg bg-background border border-border hover:border-primary/20 transition-colors text-left">
              <ClipboardList className="w-4 h-4 text-blue-600 shrink-0" />
              <div>
                <p className="text-lg font-bold leading-none">{loading ? '–' : focusTasks.length}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Aktiva tasks</p>
              </div>
            </button>
            <button onClick={() => navigate('/admin/orders')} className="flex items-center gap-2 p-2.5 rounded-lg bg-background border border-border hover:border-primary/20 transition-colors text-left">
              <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
              <div>
                <p className="text-lg font-bold leading-none">{loading ? '–' : focusIncidents.filter(i => i.sla_status === 'overdue').length}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Försenade</p>
              </div>
            </button>
            <button onClick={() => navigate('/admin/communication')} className="flex items-center gap-2 p-2.5 rounded-lg bg-background border border-border hover:border-primary/20 transition-colors text-left">
              <Star className="w-4 h-4 text-yellow-600 shrink-0" />
              <div>
                <p className="text-lg font-bold leading-none">{loading ? '–' : stats.pendingReviews}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Recensioner</p>
              </div>
            </button>
          </div>

          {/* Active tasks list */}
          {focusTasks.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground px-1">Uppgifter att göra</p>
              {focusTasks.slice(0, 3).map(task => (
                <button
                  key={task.id}
                  onClick={() => navigate('/admin/staff')}
                  className="w-full flex items-center gap-2 p-2 rounded-md bg-background hover:bg-secondary/50 transition-colors text-left"
                >
                  <PlayCircle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-sm truncate flex-1">{task.title}</span>
                  <Badge variant="outline" className={cn('text-[9px] shrink-0', PRIORITY_COLORS[task.priority])}>
                    {task.priority === 'high' ? 'HÖG' : task.priority === 'medium' ? 'MED' : 'LÅG'}
                  </Badge>
                </button>
              ))}
              {focusTasks.length > 3 && (
                <button onClick={() => navigate('/admin/staff')} className="text-xs text-primary hover:underline px-1">
                  +{focusTasks.length - 3} fler uppgifter →
                </button>
              )}
            </div>
          )}

          {/* Active incidents */}
          {focusIncidents.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground px-1">Öppna ärenden</p>
              {focusIncidents.slice(0, 3).map(inc => (
                <button
                  key={inc.id}
                  onClick={() => navigate('/admin/orders')}
                  className="w-full flex items-center gap-2 p-2 rounded-md bg-background hover:bg-secondary/50 transition-colors text-left"
                >
                  <AlertTriangle className={cn('w-3.5 h-3.5 shrink-0', inc.sla_status === 'overdue' ? 'text-destructive' : 'text-amber-500')} />
                  <span className="text-sm truncate flex-1">{inc.title}</span>
                  {inc.sla_status === 'overdue' && (
                    <Badge variant="destructive" className="text-[9px] shrink-0">FÖRSENAD</Badge>
                  )}
                  {inc.sla_status === 'warning' && (
                    <Badge variant="outline" className="text-[9px] border-amber-400 text-amber-600 shrink-0">VARNING</Badge>
                  )}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {topCards.map((card) => (
          <Card
            key={card.title}
            className="border-border cursor-pointer hover:shadow-md hover:border-primary/20 transition-all active:scale-[0.97] group"
            onClick={() => navigate(card.href)}
          >
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{card.title}</span>
                <div className={`w-8 h-8 rounded-lg ${card.bgColor} flex items-center justify-center`}>
                  <card.icon className={`w-4 h-4 ${card.color}`} />
                </div>
              </div>
              <p className="text-xl sm:text-2xl font-bold">{loading ? '–' : card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" className="gap-2" onClick={() => navigate('/admin/products')}>
          <Plus className="w-4 h-4" /> Skapa produkt
        </Button>
        <Button size="sm" variant="outline" className="gap-2" onClick={() => navigate('/admin/orders')}>
          <Eye className="w-4 h-4" /> Visa ordrar
        </Button>
        <Button size="sm" variant="outline" className="gap-2" onClick={() => navigate('/admin/staff')}>
          <ClipboardList className="w-4 h-4" /> Workbench
        </Button>
        <Button
          size="sm"
          variant={siteActive ? 'outline' : 'destructive'}
          className="gap-2"
          onClick={() => setSiteActive(!siteActive)}
        >
          <Power className="w-4 h-4" />
          {siteActive ? 'Stäng butiken' : 'Öppna butiken'}
        </Button>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Senaste ordrar</CardTitle>
              <Link to="/admin/orders" className="text-xs text-primary hover:underline flex items-center gap-1">
                Alla ordrar <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Laddar...</p>
            ) : recentOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Inga ordrar ännu</p>
            ) : (
              recentOrders.map((order) => (
                <Link
                  key={order.id}
                  to="/admin/orders"
                  className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/60 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{order.payment_intent_id ? '#' + order.payment_intent_id.slice(-8).toUpperCase() : order.order_email}</p>
                    <p className="text-xs text-muted-foreground">{formatTime(order.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <span className="text-sm font-semibold">{formatCurrency(order.total_amount)}</span>
                    <Badge variant="outline" className={`text-[10px] ${statusColors[order.status] || ''}`}>
                      {order.status}
                    </Badge>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        {/* Low Stock Warnings */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Lågt lager
              </CardTitle>
              <Link to="/admin/products" className="text-xs text-primary hover:underline flex items-center gap-1">
                Alla produkter <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Laddar...</p>
            ) : lowStockItems.length === 0 ? (
              <div className="flex flex-col items-center py-6 text-center">
                <Package className="w-8 h-8 text-green-500/50 mb-2" />
                <p className="text-sm text-muted-foreground">Alla produkter har bra lagernivåer 👍</p>
              </div>
            ) : (
              lowStockItems.map((product) => (
                <div key={product.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                  <p className="text-sm font-medium truncate flex-1">{product.title_sv}</p>
                  <Badge
                    variant={product.stock === 0 ? 'destructive' : 'outline'}
                    className={product.stock > 0 ? 'border-amber-400 text-amber-600' : ''}
                  >
                    {product.stock} st
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Link to="/admin/members">
          <Card className="border-border hover:border-primary/30 transition-colors cursor-pointer">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">{loading ? '–' : stats.totalMembers} medlemmar</span>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link to="/admin/communication">
          <Card className="border-border hover:border-primary/30 transition-colors cursor-pointer">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">{loading ? '–' : stats.pendingReviews} väntande recensioner</span>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link to="/admin/products">
          <Card className="border-border hover:border-primary/30 transition-colors cursor-pointer">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">{loading ? '–' : stats.lowStockProducts} lågt lager</span>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link to="/admin/orders">
          <Card className="border-border hover:border-primary/30 transition-colors cursor-pointer">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">{loading ? '–' : stats.totalOrders} totalt ordrar</span>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
};

export default AdminOverview;
