import { useState, useEffect } from 'react';
import {
  Package, ClipboardList, Users, Star, TrendingUp, AlertTriangle,
  DollarSign, ShoppingCart, Plus, Eye, Power, ArrowRight, Clock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Link, useNavigate } from 'react-router-dom';
import { useStoreSettings } from '@/stores/storeSettingsStore';

interface RecentOrder {
  id: string;
  order_email: string;
  total_amount: number;
  status: string;
  payment_status: string;
  created_at: string;
}

interface LowStockProduct {
  id: string;
  title_sv: string;
  stock: number;
  reserved_stock: number;
}

const statusColors: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  confirmed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  processing: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  shipped: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  delivered: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const AdminOverview = () => {
  const navigate = useNavigate();
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

  useEffect(() => {
    const load = async () => {
      try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const [products, orders, todayOrders, members, reviews] = await Promise.all([
          supabase.from('products').select('id, title_sv, stock, reserved_stock, allow_overselling'),
          supabase.from('orders').select('id, status, total_amount, payment_status'),
          supabase.from('orders').select('id, total_amount, payment_status').gte('created_at', todayStart.toISOString()),
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_member', true),
          supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('is_approved', false),
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

        // Recent orders
        const { data: recent } = await supabase
          .from('orders')
          .select('id, order_email, total_amount, status, payment_status, created_at')
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

  const topCards = [
    {
      title: 'Ordrar idag',
      value: stats.ordersToday,
      icon: ShoppingCart,
      color: 'text-blue-600',
      bgColor: 'bg-blue-500/10',
      href: '/admin/orders',
    },
    {
      title: 'Intäkter idag',
      value: formatCurrency(stats.revenueToday),
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-500/10',
      href: '/admin/finance',
    },
    {
      title: 'Väntande ordrar',
      value: stats.pendingOrders,
      icon: Clock,
      color: 'text-amber-600',
      bgColor: 'bg-amber-500/10',
      href: '/admin/orders',
    },
    {
      title: 'Produkter',
      value: stats.totalProducts,
      icon: Package,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      href: '/admin/products',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Översikt av din butik</p>
        </div>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {topCards.map((card) => (
          <Card key={card.title} className="border-border">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{card.title}</span>
                <div className={`w-8 h-8 rounded-lg ${card.bgColor} flex items-center justify-center`}>
                  <card.icon className={`w-4 h-4 ${card.color}`} />
                </div>
              </div>
              <p className="text-2xl font-bold">{loading ? '–' : card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" className="gap-2" onClick={() => navigate('/admin/products')}>
          <Plus className="w-4 h-4" />
          Skapa produkt
        </Button>
        <Button size="sm" variant="outline" className="gap-2" onClick={() => navigate('/admin/orders')}>
          <Eye className="w-4 h-4" />
          Visa ordrar
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
        {checkoutEnabled ? (
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={() => setCheckoutEnabled(false)}
          >
            Stäng av kassa
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={() => setCheckoutEnabled(true)}
          >
            Aktivera kassa
          </Button>
        )}
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
                    <p className="text-sm font-medium truncate">{order.order_email}</p>
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
                <div
                  key={product.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-secondary/30"
                >
                  <p className="text-sm font-medium truncate flex-1">{product.title_sv}</p>
                  <div className="flex items-center gap-2 ml-3">
                    <Badge
                      variant={product.stock === 0 ? 'destructive' : 'outline'}
                      className={product.stock > 0 ? 'border-amber-400 text-amber-600' : ''}
                    >
                      {product.stock} st
                      {product.reserved_stock > 0 && ` (${product.reserved_stock} res.)`}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom summary row */}
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
