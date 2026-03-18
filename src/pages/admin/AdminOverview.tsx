import { useState, useEffect } from 'react';
import { Package, ClipboardList, Users, Star, TrendingUp, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';

const AdminOverview = () => {
  const [stats, setStats] = useState({
    totalProducts: 0,
    lowStockProducts: 0,
    totalOrders: 0,
    pendingOrders: 0,
    totalMembers: 0,
    pendingReviews: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [products, orders, members, reviews] = await Promise.all([
          supabase.from('products').select('id, stock, allow_overselling', { count: 'exact' }),
          supabase.from('orders').select('id, status', { count: 'exact' }),
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_member', true),
          supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('is_approved', false),
        ]);

        const prods = products.data || [];
        const ords = orders.data || [];

        setStats({
          totalProducts: prods.length,
          lowStockProducts: prods.filter(p => !p.allow_overselling && p.stock <= 5 && p.stock > 0).length,
          totalOrders: ords.length,
          pendingOrders: ords.filter(o => o.status === 'pending').length,
          totalMembers: members.count || 0,
          pendingReviews: reviews.count || 0,
        });
      } catch (e) {
        console.error('Failed to load admin stats:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const cards = [
    { title: 'Ordrar', value: stats.totalOrders, sub: `${stats.pendingOrders} väntande`, icon: ClipboardList, link: '/admin/orders', color: 'text-blue-600' },
    { title: 'Produkter', value: stats.totalProducts, sub: `${stats.lowStockProducts} lågt lager`, icon: Package, link: '/admin/products', color: 'text-primary' },
    { title: 'Medlemmar', value: stats.totalMembers, sub: 'registrerade', icon: Users, link: '/admin/members', color: 'text-green-600' },
    { title: 'Recensioner', value: stats.pendingReviews, sub: 'väntande granskning', icon: Star, link: '/admin/communication', color: 'text-amber-600' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Översikt</h1>
        <p className="text-muted-foreground text-sm mt-1">Snabböversikt över din butik</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <Link key={card.title} to={card.link}>
            <Card className="border-border hover:border-primary/30 transition-colors cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
                <card.icon className={`w-4 h-4 ${card.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{loading ? '–' : card.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Alerts */}
      {!loading && stats.lowStockProducts > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <p className="font-medium text-sm">{stats.lowStockProducts} produkter har lågt lagersaldo</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              <Link to="/admin/products" className="underline">Hantera lager →</Link>
            </p>
          </div>
        </div>
      )}

      {!loading && stats.pendingOrders > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30">
          <ClipboardList className="w-5 h-5 text-blue-600 shrink-0" />
          <div>
            <p className="font-medium text-sm">{stats.pendingOrders} ordrar väntar på behandling</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              <Link to="/admin/orders" className="underline">Visa ordrar →</Link>
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminOverview;
