import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp, Package, DollarSign, ArrowUpRight, RefreshCw,
  Search, Eye, ShoppingCart, AlertTriangle, BarChart3, MousePointerClick, FlaskConical
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';

interface ProductSale {
  id: string;
  shopify_product_id: string;
  product_title: string;
  total_quantity_sold: number;
  last_sale_at: string | null;
}

interface SearchLog {
  search_term: string;
  count: number;
}

interface AnalyticsEvent {
  event_type: string;
  event_data: any;
  created_at: string;
}

const AdminStats = () => {
  const [salesData, setSalesData] = useState<ProductSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalSold, setTotalSold] = useState(0);
  const [topProducts, setTopProducts] = useState<ProductSale[]>([]);
  const [recentActivity, setRecentActivity] = useState<ProductSale[]>([]);
  const [topSearches, setTopSearches] = useState<SearchLog[]>([]);
  const [productViews, setProductViews] = useState<{ title: string; count: number }[]>([]);
  const [checkoutStats, setCheckoutStats] = useState({ starts: 0, completes: 0, abandons: 0, dropOffRate: 0 });
  const [ingredientStats, setIngredientStats] = useState<{ name: string; searches: number; clicks: number }[]>([]);

  useEffect(() => {
    fetchAllData();
    const channel = supabase
      .channel('admin_sales_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'product_sales' }, () => fetchSalesData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchAllData = async () => {
    await Promise.all([fetchSalesData(), fetchSearchData(), fetchAnalyticsData(), fetchIngredientStats()]);
  };

  const fetchSalesData = async () => {
    try {
      const { data, error } = await supabase.from('product_sales').select('*').order('total_quantity_sold', { ascending: false });
      if (error) throw error;
      const sales = (data || []) as ProductSale[];
      setSalesData(sales);
      setTotalSold(sales.reduce((sum, item) => sum + item.total_quantity_sold, 0));
      setTopProducts(sales.slice(0, 5));
      const sorted = [...sales].filter(s => s.last_sale_at).sort((a, b) => new Date(b.last_sale_at!).getTime() - new Date(a.last_sale_at!).getTime());
      setRecentActivity(sorted.slice(0, 5));
    } catch (error) {
      console.error('Error fetching sales data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSearchData = async () => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data } = await supabase
        .from('search_logs')
        .select('search_term')
        .gte('created_at', thirtyDaysAgo.toISOString());

      if (data) {
        // Aggregate search terms
        const counts: Record<string, number> = {};
        data.forEach(d => {
          const term = d.search_term.toLowerCase();
          counts[term] = (counts[term] || 0) + 1;
        });
        const sorted = Object.entries(counts)
          .map(([search_term, count]) => ({ search_term, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 15);
        setTopSearches(sorted);
      }
    } catch (e) {
      console.error('Failed to fetch searches:', e);
    }
  };

  const fetchAnalyticsData = async () => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data } = await supabase
        .from('analytics_events')
        .select('event_type, event_data, created_at')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(1000);

      if (data) {
        const events = data as unknown as AnalyticsEvent[];

        // Product views
        const viewCounts: Record<string, number> = {};
        events.filter(e => e.event_type === 'product_view').forEach(e => {
          const title = e.event_data?.product_title || 'Okänd';
          viewCounts[title] = (viewCounts[title] || 0) + 1;
        });
        const sortedViews = Object.entries(viewCounts)
          .map(([title, count]) => ({ title, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);
        setProductViews(sortedViews);

        // Checkout funnel
        const starts = events.filter(e => e.event_type === 'checkout_start').length;
        const completes = events.filter(e => e.event_type === 'checkout_complete').length;
        const abandons = events.filter(e => e.event_type === 'checkout_abandon').length;
        const dropOffRate = starts > 0 ? Math.round(((starts - completes) / starts) * 100) : 0;
        setCheckoutStats({ starts, completes, abandons, dropOffRate });
      }
    } catch (e) {
      console.error('Failed to fetch analytics:', e);
    }
  };

  const getStatusBadge = (count: number) => {
    if (count > 25) return <Badge className="bg-accent/20 text-accent border-0">Många har upptäckt</Badge>;
    if (count > 15) return <Badge className="bg-primary/20 text-primary border-0">🔥 Trendar</Badge>;
    if (count > 5) return <Badge className="bg-secondary text-secondary-foreground border-0">Populär</Badge>;
    return <Badge variant="outline" className="text-muted-foreground">Ny</Badge>;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('sv-SE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Statistik & Analytics</h1>
          <p className="text-muted-foreground text-sm mt-1">Försäljning, sökningar, produktvisningar och checkout-flöde</p>
        </div>
        <Button onClick={fetchAllData} variant="outline" size="sm" className="gap-2">
          <RefreshCw className="w-4 h-4" /> Uppdatera
        </Button>
      </div>

      {/* Overview stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="border-border"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Totalt sålda</CardTitle><Package className="w-4 h-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{totalSold}</div></CardContent></Card>
        <Card className="border-border"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Produktvisningar</CardTitle><Eye className="w-4 h-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{productViews.reduce((s, v) => s + v.count, 0)}</div></CardContent></Card>
        <Card className="border-border"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Sökningar</CardTitle><Search className="w-4 h-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{topSearches.reduce((s, t) => s + t.count, 0)}</div></CardContent></Card>
        <Card className="border-border"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Checkout-start</CardTitle><ShoppingCart className="w-4 h-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{checkoutStats.starts}</div></CardContent></Card>
        <Card className="border-border"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Drop-off</CardTitle><AlertTriangle className="w-4 h-4 text-destructive" /></CardHeader><CardContent><div className="text-2xl font-bold text-destructive">{checkoutStats.dropOffRate}%</div></CardContent></Card>
      </div>

      <Tabs defaultValue="sales" className="space-y-4">
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="sales">Försäljning</TabsTrigger>
          <TabsTrigger value="views">Produktvisningar</TabsTrigger>
          <TabsTrigger value="searches">Sökningar</TabsTrigger>
          <TabsTrigger value="checkout">Checkout-flöde</TabsTrigger>
        </TabsList>

        {/* Sales tab */}
        <TabsContent value="sales" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-border">
              <CardHeader><CardTitle className="text-lg font-semibold flex items-center gap-2"><TrendingUp className="w-5 h-5 text-accent" /> Topprodukter</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {topProducts.map((product, index) => (
                    <motion.div key={product.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.1 }} className="flex items-center justify-between p-3 rounded-xl bg-secondary/50">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">{index + 1}</div>
                        <div>
                          <p className="font-medium text-sm">{product.product_title}</p>
                          <p className="text-xs text-muted-foreground">Senast: {formatDate(product.last_sale_at)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">{getStatusBadge(product.total_quantity_sold)}<span className="font-bold text-lg">{product.total_quantity_sold}</span></div>
                    </motion.div>
                  ))}
                  {topProducts.length === 0 && <div className="text-center py-8 text-muted-foreground">Ingen försäljningsdata ännu</div>}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader><CardTitle className="text-lg font-semibold flex items-center gap-2"><RefreshCw className="w-5 h-5 text-primary" /> Senaste aktivitet</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentActivity.map((product, index) => (
                    <motion.div key={product.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.1 }} className="flex items-center justify-between p-3 rounded-xl bg-secondary/50">
                      <div>
                        <p className="font-medium text-sm">{product.product_title}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(product.last_sale_at)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <ArrowUpRight className="w-4 h-4 text-accent" />
                        <span className="text-sm font-medium text-accent">+{product.total_quantity_sold} st</span>
                      </div>
                    </motion.div>
                  ))}
                  {recentActivity.length === 0 && <div className="text-center py-8 text-muted-foreground">Ingen aktivitet ännu</div>}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Product Views tab */}
        <TabsContent value="views">
          <Card className="border-border">
            <CardHeader><CardTitle className="text-lg font-semibold flex items-center gap-2"><Eye className="w-5 h-5 text-primary" /> Mest visade produkter (30 dagar)</CardTitle></CardHeader>
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
                      <span className="text-xs text-muted-foreground">visningar</span>
                    </div>
                  </div>
                ))}
                {productViews.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Eye className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p>Ingen data ännu — visningar spåras automatiskt</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Searches tab */}
        <TabsContent value="searches">
          <Card className="border-border">
            <CardHeader><CardTitle className="text-lg font-semibold flex items-center gap-2"><Search className="w-5 h-5 text-primary" /> Populäraste sökningar (30 dagar)</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {topSearches.map((s, idx) => (
                  <div key={s.search_term} className="flex items-center justify-between p-3 rounded-xl bg-secondary/50">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">{idx + 1}</div>
                      <span className="font-medium text-sm">"{s.search_term}"</span>
                    </div>
                    <Badge variant="outline">{s.count} sökningar</Badge>
                  </div>
                ))}
                {topSearches.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p>Inga sökningar registrerade ännu</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Checkout funnel tab */}
        <TabsContent value="checkout">
          <Card className="border-border">
            <CardHeader><CardTitle className="text-lg font-semibold flex items-center gap-2"><BarChart3 className="w-5 h-5 text-primary" /> Checkout-tratt (30 dagar)</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              {/* Funnel visualization */}
              <div className="space-y-3">
                <div className="relative">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">Checkout påbörjad</span>
                    <span className="text-sm font-bold">{checkoutStats.starts}</span>
                  </div>
                  <div className="h-8 rounded-lg bg-primary/20 relative overflow-hidden">
                    <div className="h-full bg-primary/60 rounded-lg" style={{ width: '100%' }} />
                  </div>
                </div>

                <div className="relative">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">Betalning genomförd</span>
                    <span className="text-sm font-bold">{checkoutStats.completes}</span>
                  </div>
                  <div className="h-8 rounded-lg bg-accent/20 relative overflow-hidden">
                    <div
                      className="h-full bg-accent/60 rounded-lg transition-all"
                      style={{ width: checkoutStats.starts > 0 ? `${(checkoutStats.completes / checkoutStats.starts) * 100}%` : '0%' }}
                    />
                  </div>
                </div>

                <div className="relative">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">Avbrutna</span>
                    <span className="text-sm font-bold text-destructive">{checkoutStats.abandons}</span>
                  </div>
                  <div className="h-8 rounded-lg bg-destructive/10 relative overflow-hidden">
                    <div
                      className="h-full bg-destructive/40 rounded-lg transition-all"
                      style={{ width: checkoutStats.starts > 0 ? `${(checkoutStats.abandons / checkoutStats.starts) * 100}%` : '0%' }}
                    />
                  </div>
                </div>
              </div>

              {/* Conversion stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-secondary/50 text-center">
                  <p className="text-2xl font-bold text-primary">{checkoutStats.starts > 0 ? Math.round((checkoutStats.completes / checkoutStats.starts) * 100) : 0}%</p>
                  <p className="text-xs text-muted-foreground mt-1">Konverteringsgrad</p>
                </div>
                <div className="p-4 rounded-xl bg-secondary/50 text-center">
                  <p className="text-2xl font-bold text-destructive">{checkoutStats.dropOffRate}%</p>
                  <p className="text-xs text-muted-foreground mt-1">Drop-off rate</p>
                </div>
                <div className="p-4 rounded-xl bg-secondary/50 text-center">
                  <p className="text-2xl font-bold">{checkoutStats.starts}</p>
                  <p className="text-xs text-muted-foreground mt-1">Totala checkout-besök</p>
                </div>
              </div>

              {checkoutStats.dropOffRate > 50 && (
                <div className="flex items-start gap-3 p-4 rounded-xl border border-destructive/20 bg-destructive/5">
                  <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Hög drop-off rate</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Över 50% av besökarna lämnar checkout. Tips: Förenkla formuläret, lägg till fler betalmetoder, visa tydligare fraktinfo.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* All sales table */}
      <Card className="border-border">
        <CardHeader><CardTitle className="text-lg font-semibold">Alla produkter med försäljning</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Produkt</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Senaste försäljning</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Antal sålda</th>
                </tr>
              </thead>
              <tbody>
                {salesData.map((product) => (
                  <tr key={product.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                    <td className="py-3 px-4 font-medium text-sm">{product.product_title}</td>
                    <td className="py-3 px-4">{getStatusBadge(product.total_quantity_sold)}</td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">{formatDate(product.last_sale_at)}</td>
                    <td className="py-3 px-4 text-right font-bold">{product.total_quantity_sold}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {salesData.length === 0 && <div className="text-center py-12 text-muted-foreground">Ingen försäljningsdata tillgänglig</div>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminStats;
