import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Loader2 } from 'lucide-react';

type Range = '7d' | '30d' | '90d';

interface DayData {
  date: string;
  label: string;
  revenue: number;
  orders: number;
  checkoutStarts: number;
  checkoutCompletes: number;
}

const ranges: { value: Range; label: string }[] = [
  { value: '7d', label: '7 dagar' },
  { value: '30d', label: '30 dagar' },
  { value: '90d', label: '90 dagar' },
];

const fmt = (n: number) =>
  new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', minimumFractionDigits: 0 }).format(n);

const AdminDashboardCharts = () => {
  const [range, setRange] = useState<Range>('30d');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DayData[]>([]);

  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const from = new Date();
      from.setDate(from.getDate() - days);
      from.setHours(0, 0, 0, 0);

      const [ordersRes, analyticsRes] = await Promise.all([
        supabase
          .from('orders')
          .select('created_at, total_amount, payment_status')
          .is('deleted_at', null)
          .gte('created_at', from.toISOString()),
        supabase
          .from('analytics_events')
          .select('event_type, created_at')
          .in('event_type', ['checkout_start', 'checkout_complete'])
          .gte('created_at', from.toISOString()),
      ]);

      const orders = ordersRes.data || [];
      const analytics = analyticsRes.data || [];

      // Build day buckets
      const buckets: Record<string, DayData> = {};
      for (let i = 0; i < days; i++) {
        const d = new Date();
        d.setDate(d.getDate() - (days - 1 - i));
        const key = d.toISOString().slice(0, 10);
        buckets[key] = {
          date: key,
          label: d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }),
          revenue: 0,
          orders: 0,
          checkoutStarts: 0,
          checkoutCompletes: 0,
        };
      }

      orders.forEach((o: any) => {
        const key = o.created_at.slice(0, 10);
        if (buckets[key]) {
          if (o.payment_status === 'paid') {
            buckets[key].revenue += o.total_amount || 0;
            buckets[key].orders += 1;
          }
        }
      });

      analytics.forEach((e: any) => {
        const key = e.created_at.slice(0, 10);
        if (buckets[key]) {
          if (e.event_type === 'checkout_start') buckets[key].checkoutStarts += 1;
          if (e.event_type === 'checkout_complete') buckets[key].checkoutCompletes += 1;
        }
      });

      setData(Object.values(buckets));
      setLoading(false);
    };
    fetch();
  }, [range, days]);

  const conversionData = useMemo(() =>
    data.map(d => ({
      ...d,
      conversion: d.checkoutStarts > 0 ? Math.round((d.checkoutCompletes / d.checkoutStarts) * 100) : 0,
    })),
    [data]
  );

  const tickInterval = days <= 7 ? 0 : days <= 30 ? 4 : 13;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Range toggle */}
      <div className="flex items-center gap-1 bg-secondary/50 rounded-lg p-1 w-fit">
        {ranges.map(r => (
          <Button
            key={r.value}
            variant={range === r.value ? 'default' : 'ghost'}
            size="sm"
            className="text-xs h-7 px-3"
            onClick={() => setRange(r.value)}
          >
            {r.label}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue chart */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Intäkter</CardTitle>
          </CardHeader>
          <CardContent className="h-48 sm:h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={tickInterval} className="text-muted-foreground" />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${Math.round(v / 1000)}k`} className="text-muted-foreground" />
                <Tooltip formatter={(v: number) => [fmt(v), 'Intäkt']} labelClassName="text-xs" />
                <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Orders chart */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Ordrar</CardTitle>
          </CardHeader>
          <CardContent className="h-48 sm:h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={tickInterval} className="text-muted-foreground" />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} className="text-muted-foreground" />
                <Tooltip formatter={(v: number) => [v, 'Ordrar']} labelClassName="text-xs" />
                <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Conversion chart */}
        <Card className="border-border lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Konverteringsgrad (%)</CardTitle>
          </CardHeader>
          <CardContent className="h-40 sm:h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={conversionData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={tickInterval} className="text-muted-foreground" />
                <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} unit="%" className="text-muted-foreground" />
                <Tooltip formatter={(v: number) => [`${v}%`, 'Konvertering']} labelClassName="text-xs" />
                <Line type="monotone" dataKey="conversion" stroke="hsl(142, 76%, 36%)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboardCharts;
