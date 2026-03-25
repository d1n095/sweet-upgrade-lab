import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrendingUp, ShoppingCart, Eye, ArrowDown, BarChart3, Package } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  useAdminOrders, useAdminAnalytics, useAdminProductSales,
  PAID_STATUS, computeFunnelMetrics,
} from '@/hooks/useAdminData';

type Period = '7d' | '30d' | '90d';

const AdminGrowth = () => {
  const [period, setPeriod] = useState<Period>('30d');
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;

  const { data: orders = [], isLoading: ordersLoading } = useAdminOrders();
  const { data: events = [], isLoading: eventsLoading } = useAdminAnalytics(days);
  const { data: productSales = [], isLoading: salesLoading } = useAdminProductSales();

  const loading = ordersLoading || eventsLoading || salesLoading;

  const since = useMemo(() => new Date(Date.now() - days * 86400000).toISOString(), [days]);

  const periodOrders = useMemo(() =>
    orders.filter((o: any) => o.created_at >= since),
    [orders, since]
  );

  const funnel = useMemo(() => computeFunnelMetrics(events), [events]);
  const purchases = useMemo(() =>
    periodOrders.filter((o: any) => o.payment_status === PAID_STATUS).length,
    [periodOrders]
  );

  const topProducts = useMemo(() =>
    productSales.slice(0, 10).map((s: any) => ({ title: s.product_title, sold: s.total_quantity_sold })),
    [productSales]
  );

  const { revenueData, conversionData } = useMemo(() => {
    const buckets: Record<string, { revenue: number; starts: number; completes: number }> = {};
    for (let i = 0; i < days; i++) {
      const d = new Date(Date.now() - i * 86400000);
      const key = d.toISOString().slice(0, 10);
      buckets[key] = { revenue: 0, starts: 0, completes: 0 };
    }
    periodOrders.forEach((o: any) => {
      const key = o.created_at.slice(0, 10);
      if (buckets[key] && o.payment_status === PAID_STATUS) {
        buckets[key].revenue += o.total_amount || 0;
        buckets[key].completes += 1;
      }
    });
    events.forEach((e: any) => {
      const key = e.created_at.slice(0, 10);
      if (buckets[key]) {
        if (e.event_type === 'checkout_start') buckets[key].starts += 1;
        if (e.event_type === 'checkout_complete') buckets[key].completes += 1;
      }
    });
    const sorted = Object.entries(buckets).sort(([a], [b]) => a.localeCompare(b));
    return {
      revenueData: sorted.map(([date, v]) => ({ date: date.slice(5), revenue: v.revenue })),
      conversionData: sorted.map(([date, v]) => ({
        date: date.slice(5),
        rate: v.starts > 0 ? Math.round((v.completes / v.starts) * 100) : 0,
      })),
    };
  }, [periodOrders, events, days]);

  const funnelSteps = [
    { label: 'Besök', value: funnel.views, icon: Eye, color: 'text-blue-600', bg: 'bg-blue-500/10' },
    { label: 'Kundvagn', value: funnel.carts, icon: ShoppingCart, color: 'text-purple-600', bg: 'bg-purple-500/10' },
    { label: 'Checkout', value: funnel.checkoutStarts, icon: BarChart3, color: 'text-orange-600', bg: 'bg-orange-500/10' },
    { label: 'Köp', value: purchases, icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-500/10' },
  ];

  const overallConversion = funnel.views > 0 ? ((purchases / funnel.views) * 100).toFixed(1) : '0';
  const cartToCheckout = funnel.carts > 0 ? ((funnel.checkoutStarts / funnel.carts) * 100).toFixed(0) : '0';
  const checkoutToPurchase = funnel.checkoutStarts > 0 ? ((purchases / funnel.checkoutStarts) * 100).toFixed(0) : '0';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Tillväxt</h1>
          <p className="text-sm text-muted-foreground">Funnel, konvertering & topprodukter</p>
        </div>
        <div className="flex gap-1 bg-secondary rounded-lg p-0.5">
          {(['7d', '30d', '90d'] as Period[]).map(p => (
            <Button key={p} size="sm" variant={period === p ? 'default' : 'ghost'} className="text-xs h-7 px-3" onClick={() => setPeriod(p)}>
              {p === '7d' ? '7 dagar' : p === '30d' ? '30 dagar' : '90 dagar'}
            </Button>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Konverteringstratt</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {funnelSteps.map((step, i) => (
              <div key={step.label} className="relative">
                <div className="flex items-center gap-2 p-3 rounded-lg border border-border">
                  <div className={`w-8 h-8 rounded-lg ${step.bg} flex items-center justify-center shrink-0`}>
                    <step.icon className={`w-4 h-4 ${step.color}`} />
                  </div>
                  <div>
                    <p className="text-lg font-bold leading-none">{loading ? '–' : step.value.toLocaleString('sv-SE')}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{step.label}</p>
                  </div>
                </div>
                {i < funnelSteps.length - 1 && i > 0 && (
                  <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 hidden sm:flex items-center gap-1">
                    <ArrowDown className="w-3 h-3 text-muted-foreground" />
                    <span className="text-[9px] text-muted-foreground font-medium">
                      {i === 1 ? `${cartToCheckout}%` : `${checkoutToPurchase}%`}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-4 text-sm">
            <Badge variant="outline" className="text-xs">Total konvertering: {overallConversion}%</Badge>
            <Badge variant="outline" className="text-xs">Vagn → Checkout: {cartToCheckout}%</Badge>
            <Badge variant="outline" className="text-xs">Checkout → Köp: {checkoutToPurchase}%</Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Intäkter</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip />
                  <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="hsl(var(--primary)/0.1)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Konverteringsgrad (%)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={conversionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip />
                  <Bar dataKey="rate" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Package className="w-4 h-4" /> Topprodukter
          </CardTitle>
        </CardHeader>
        <CardContent>
          {topProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Ingen försäljningsdata ännu</p>
          ) : (
            <div className="space-y-2">
              {topProducts.map((p: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-secondary/30">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-muted-foreground w-5">#{i + 1}</span>
                    <span className="text-sm font-medium truncate">{p.title}</span>
                  </div>
                  <Badge variant="outline" className="text-xs">{p.sold} sålda</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminGrowth;
