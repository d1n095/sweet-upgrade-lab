import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Package, DollarSign, Users, ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { useAdminRole } from '@/hooks/useAdminRole';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface ProductSale {
  id: string;
  shopify_product_id: string;
  product_title: string;
  total_quantity_sold: number;
  last_sale_at: string | null;
}

const AdminStats = () => {
  const { isAdmin, isLoading: roleLoading } = useAdminRole();
  const navigate = useNavigate();
  const [salesData, setSalesData] = useState<ProductSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalSold, setTotalSold] = useState(0);
  const [topProducts, setTopProducts] = useState<ProductSale[]>([]);
  const [recentActivity, setRecentActivity] = useState<ProductSale[]>([]);

  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      navigate('/');
    }
  }, [isAdmin, roleLoading, navigate]);

  useEffect(() => {
    fetchSalesData();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('admin_sales_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'product_sales'
        },
        () => {
          fetchSalesData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchSalesData = async () => {
    try {
      const { data, error } = await supabase
        .from('product_sales')
        .select('*')
        .order('total_quantity_sold', { ascending: false });

      if (error) throw error;

      const sales = (data || []) as ProductSale[];
      setSalesData(sales);
      
      // Calculate total
      const total = sales.reduce((sum, item) => sum + item.total_quantity_sold, 0);
      setTotalSold(total);

      // Top 5 products
      setTopProducts(sales.slice(0, 5));

      // Recent activity (by last_sale_at)
      const sorted = [...sales]
        .filter(s => s.last_sale_at)
        .sort((a, b) => new Date(b.last_sale_at!).getTime() - new Date(a.last_sale_at!).getTime());
      setRecentActivity(sorted.slice(0, 5));

    } catch (error) {
      console.error('Error fetching sales data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (count: number) => {
    if (count > 25) {
      return <Badge className="bg-green-100 text-green-800 border-0">Många har upptäckt</Badge>;
    } else if (count > 15) {
      return <Badge className="bg-orange-100 text-orange-800 border-0">🔥 Trendar</Badge>;
    } else if (count > 5) {
      return <Badge className="bg-blue-100 text-blue-800 border-0">Populär</Badge>;
    }
    return <Badge variant="outline" className="text-muted-foreground">Ny</Badge>;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('sv-SE', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (roleLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="pt-24 pb-16">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold text-foreground">
                Försäljningsstatistik
              </h1>
              <p className="text-muted-foreground mt-1">
                Realtidsöverblick över produktförsäljning
              </p>
            </div>
            <Button
              onClick={fetchSalesData}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Uppdatera
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card className="border-border bg-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Totalt sålda
                </CardTitle>
                <Package className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{totalSold}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  produkter totalt
                </p>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Unika produkter
                </CardTitle>
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{salesData.length}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  med försäljning
                </p>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Trendande
                </CardTitle>
                <ArrowUpRight className="w-4 h-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {salesData.filter(s => s.total_quantity_sold > 15).length}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  produkter
                </p>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Snittförsäljning
                </CardTitle>
                <DollarSign className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {salesData.length > 0 ? Math.round(totalSold / salesData.length) : 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  per produkt
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Products */}
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                  Topprodukter
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {topProducts.map((product, index) => (
                    <motion.div
                      key={product.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex items-center justify-between p-3 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium text-foreground text-sm">
                            {product.product_title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Senast: {formatDate(product.last_sale_at)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {getStatusBadge(product.total_quantity_sold)}
                        <span className="font-bold text-foreground text-lg">
                          {product.total_quantity_sold}
                        </span>
                      </div>
                    </motion.div>
                  ))}

                  {topProducts.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      Ingen försäljningsdata ännu
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-blue-600" />
                  Senaste aktivitet
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentActivity.map((product, index) => (
                    <motion.div
                      key={product.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex items-center justify-between p-3 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors"
                    >
                      <div>
                        <p className="font-medium text-foreground text-sm">
                          {product.product_title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(product.last_sale_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <ArrowUpRight className="w-4 h-4 text-green-600" />
                        <span className="text-sm font-medium text-green-600">
                          +{product.total_quantity_sold} st
                        </span>
                      </div>
                    </motion.div>
                  ))}

                  {recentActivity.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      Ingen aktivitet ännu
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* All Products Table */}
          <Card className="border-border bg-card mt-6">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">
                Alla produkter med försäljning
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                        Produkt
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                        Status
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                        Senaste försäljning
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">
                        Antal sålda
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesData.map((product) => (
                      <tr key={product.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                        <td className="py-3 px-4">
                          <span className="font-medium text-foreground text-sm">
                            {product.product_title}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {getStatusBadge(product.total_quantity_sold)}
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          {formatDate(product.last_sale_at)}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-foreground">
                          {product.total_quantity_sold}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {salesData.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    Ingen försäljningsdata tillgänglig
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default AdminStats;