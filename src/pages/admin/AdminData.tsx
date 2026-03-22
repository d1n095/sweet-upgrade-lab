import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import AdminDashboardCharts from '@/components/admin/AdminDashboardCharts';
import { Search, TrendingUp, ShoppingCart, Eye, CreditCard, DollarSign, Package, AlertTriangle, Loader2, Filter, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

// ── Live KPIs ──
const fmt = (n: number) =>
  new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', minimumFractionDigits: 0 }).format(n);

type KpiRange = 'today' | '7d' | '30d';

const LiveDashboard = () => {
  const [range, setRange] = useState<KpiRange>('7d');
  const [loading, setLoading] = useState(true);
  const [kpi, setKpi] = useState({ revenue: 0, orders: 0, conversion: 0, aov: 0 });
  const [trending, setTrending] = useState<string | null>(null);
  const [lowStock, setLowStock] = useState(0);
  const [lowConversion, setLowConversion] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const from = new Date();
      if (range === 'today') from.setHours(0, 0, 0, 0);
      else if (range === '7d') from.setDate(from.getDate() - 7);
      else from.setDate(from.getDate() - 30);

      const [ordersRes, analyticsRes, stockRes] = await Promise.all([
        supabase.from('orders').select('total_amount, payment_status').is('deleted_at', null).eq('payment_status', 'paid').gte('created_at', from.toISOString()),
        supabase.from('analytics_events').select('event_type').in('event_type', ['product_view', 'checkout_complete']).gte('created_at', from.toISOString()),
        supabase.from('products').select('title_sv, stock, low_stock_threshold').eq('is_visible', true),
      ]);

      const orders = ordersRes.data || [];
      const analytics = analyticsRes.data || [];
      const products = stockRes.data || [];

      const revenue = orders.reduce((s, o: any) => s + (o.total_amount || 0), 0);
      const orderCount = orders.length;
      const views = analytics.filter((e: any) => e.event_type === 'product_view').length;
      const purchases = analytics.filter((e: any) => e.event_type === 'checkout_complete').length;
      const conversion = views > 0 ? Math.round((purchases / views) * 100) : 0;
      const aov = orderCount > 0 ? Math.round(revenue / orderCount) : 0;

      setKpi({ revenue, orders: orderCount, conversion, aov });
      setLowConversion(conversion < 2 && views > 10);
      setLowStock(products.filter((p: any) => p.stock <= (p.low_stock_threshold || 5)).length);

      // Trending: best seller by recent orders (simplified)
      try {
        const { data: salesData } = await supabase.from('products').select('title_sv, units_sold_7d').order('units_sold_7d', { ascending: false }).limit(1);
        if (salesData?.[0] && (salesData[0] as any).units_sold_7d > 0) setTrending((salesData[0] as any).title_sv);
        else setTrending(null);
      } catch { setTrending(null); }

      setLoading(false);
    };
    load();
  }, [range]);

  if (loading) return <div className="flex items-center justify-center h-32"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  const kpis = [
    { label: 'Intäkter', value: fmt(kpi.revenue), icon: DollarSign, color: 'text-green-500' },
    { label: 'Ordrar', value: String(kpi.orders), icon: ShoppingCart, color: 'text-blue-500' },
    { label: 'Konvertering', value: `${kpi.conversion}%`, icon: TrendingUp, color: kpi.conversion < 2 ? 'text-red-500' : 'text-green-500' },
    { label: 'AOV', value: fmt(kpi.aov), icon: CreditCard, color: 'text-purple-500' },
  ];

  return (
    <div className="space-y-4">
      {/* Range toggle */}
      <div className="flex items-center gap-1 bg-secondary/50 rounded-lg p-1 w-fit">
        {([['today', 'Idag'], ['7d', '7 dagar'], ['30d', '30 dagar']] as [KpiRange, string][]).map(([v, l]) => (
          <Button key={v} variant={range === v ? 'default' : 'ghost'} size="sm" className="text-xs h-7 px-3" onClick={() => setRange(v)}>{l}</Button>
        ))}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map(k => (
          <Card key={k.label} className="border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{k.label}</p>
                <k.icon className={`w-4 h-4 ${k.color}`} />
              </div>
              <p className="text-2xl font-bold mt-1">{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Alerts */}
      {(trending || lowStock > 0 || lowConversion) && (
        <div className="flex flex-wrap gap-2">
          {trending && <Badge variant="default" className="gap-1"><TrendingUp className="w-3 h-3" /> Trending: {trending}</Badge>}
          {lowStock > 0 && <Badge variant="destructive" className="gap-1"><Package className="w-3 h-3" /> {lowStock} lågt lager</Badge>}
          {lowConversion && <Badge variant="destructive" className="gap-1"><AlertTriangle className="w-3 h-3" /> Låg konvertering</Badge>}
        </div>
      )}

      {/* Charts */}
      <AdminDashboardCharts />
    </div>
  );
};

// ── Event Explorer ──
const PAGE_SIZE = 50;

const EventExplorer = () => {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [typeFilter, setTypeFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('analytics_events')
      .select('id, event_type, event_data, user_id, session_id, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (typeFilter !== 'all') query = query.eq('event_type', typeFilter);

    const { data, count, error } = await query;
    if (error) { console.error(error); toast.error('Kunde inte ladda events'); }
    setEvents(data || []);
    setTotal(count || 0);
    setLoading(false);
  }, [page, typeFilter]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  // Client search
  const filtered = useMemo(() => {
    if (!searchDebounced) return events;
    const q = searchDebounced.toLowerCase();
    return events.filter(e =>
      e.event_type?.toLowerCase().includes(q) ||
      e.user_id?.toLowerCase().includes(q) ||
      JSON.stringify(e.event_data || {}).toLowerCase().includes(q)
    );
  }, [events, searchDebounced]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const eventTypes = ['all', 'product_view', 'add_to_cart', 'remove_from_cart', 'checkout_start', 'checkout_complete', 'checkout_abandon', 'purchase'];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Sök event, user_id, produkt..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Select value={typeFilter} onValueChange={v => { setTypeFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {eventTypes.map(t => (
              <SelectItem key={t} value={t}>{t === 'all' ? 'Alla typer' : t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={fetchEvents}><RefreshCw className="w-3.5 h-3.5" /></Button>
      </div>

      {/* Funnel summary */}
      <FunnelSummary />

      <Card className="border-border">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-32"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Typ</TableHead>
                    <TableHead className="text-xs">Produkt</TableHead>
                    <TableHead className="text-xs hidden sm:table-cell">User</TableHead>
                    <TableHead className="text-xs">Tid</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Inga events</TableCell></TableRow>
                  ) : filtered.map(e => (
                    <TableRow key={e.id}>
                      <TableCell className="py-2"><Badge variant="outline" className="text-[10px]">{e.event_type}</Badge></TableCell>
                      <TableCell className="py-2 text-xs max-w-[200px] truncate">{(e.event_data as any)?.product_title || (e.event_data as any)?.product_id || '–'}</TableCell>
                      <TableCell className="py-2 text-xs hidden sm:table-cell font-mono">{e.user_id ? e.user_id.slice(0, 8) + '…' : e.session_id?.slice(0, 8) || '–'}</TableCell>
                      <TableCell className="py-2 text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString('sv-SE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{total} events totalt</p>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}><ChevronLeft className="w-4 h-4" /></Button>
          <span className="text-xs px-2">{page + 1} / {Math.max(totalPages, 1)}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}><ChevronRight className="w-4 h-4" /></Button>
        </div>
      </div>
    </div>
  );
};

// ── Funnel Summary ──
const FunnelSummary = () => {
  const [data, setData] = useState<{ views: number; carts: number; checkouts: number; purchases: number } | null>(null);

  useEffect(() => {
    const load = async () => {
      const from = new Date();
      from.setDate(from.getDate() - 30);
      const { data: events } = await supabase
        .from('analytics_events')
        .select('event_type')
        .in('event_type', ['product_view', 'add_to_cart', 'checkout_start', 'checkout_complete'])
        .gte('created_at', from.toISOString());
      if (!events) return;
      setData({
        views: events.filter((e: any) => e.event_type === 'product_view').length,
        carts: events.filter((e: any) => e.event_type === 'add_to_cart').length,
        checkouts: events.filter((e: any) => e.event_type === 'checkout_start').length,
        purchases: events.filter((e: any) => e.event_type === 'checkout_complete').length,
      });
    };
    load();
  }, []);

  if (!data) return null;

  const steps = [
    { label: 'Visningar', count: data.views, pct: 100 },
    { label: 'Varukorg', count: data.carts, pct: data.views > 0 ? Math.round((data.carts / data.views) * 100) : 0 },
    { label: 'Kassa', count: data.checkouts, pct: data.views > 0 ? Math.round((data.checkouts / data.views) * 100) : 0 },
    { label: 'Köp', count: data.purchases, pct: data.views > 0 ? Math.round((data.purchases / data.views) * 100) : 0 },
  ];

  return (
    <Card className="border-border">
      <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Funnel (30 dagar)</CardTitle></CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-2">
          {steps.map((s, i) => (
            <div key={s.label} className="text-center">
              <p className="text-lg font-bold">{s.count}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
              <p className="text-xs font-mono text-muted-foreground">{s.pct}%</p>
              {i < steps.length - 1 && (
                <div className="text-muted-foreground text-lg mt-1 hidden sm:block">→</div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// ── Main Page ──
const AdminData = () => {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Data Center</h1>
      <Tabs defaultValue="live" className="w-full">
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="live" className="text-xs">📊 Live Dashboard</TabsTrigger>
          <TabsTrigger value="events" className="text-xs">🧠 Event Explorer</TabsTrigger>
        </TabsList>
        <TabsContent value="live" className="mt-4">
          <LiveDashboard />
        </TabsContent>
        <TabsContent value="events" className="mt-4">
          <EventExplorer />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminData;
