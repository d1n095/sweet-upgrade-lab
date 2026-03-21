import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchDbProducts, updateDbProduct, DbProduct } from '@/lib/products';
import { useLanguage } from '@/context/LanguageContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertTriangle, TrendingUp, TrendingDown, Package, RefreshCw, Save, Flame,
  ArrowUp, ArrowDown, BarChart3,
} from 'lucide-react';
import { toast } from 'sonner';

type StockView = 'overview' | 'low_stock' | 'trending' | 'slow';

const AdminStockIntelligence = () => {
  const { language } = useLanguage();
  const sv = language === 'sv';
  const [view, setView] = useState<StockView>('overview');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editThreshold, setEditThreshold] = useState('');
  const [editRestock, setEditRestock] = useState('');

  const { data: products = [], refetch } = useQuery({
    queryKey: ['admin-db-products'],
    queryFn: () => fetchDbProducts(true),
  });

  const stats = useMemo(() => {
    const lowStock = products.filter(p => p.stock > 0 && p.stock <= p.low_stock_threshold);
    const outOfStock = products.filter(p => p.stock <= 0);
    const trending = products.filter(p => p.units_sold_7d >= 5).sort((a, b) => b.units_sold_7d - a.units_sold_7d);
    const slow = products.filter(p => p.status === 'active' && p.units_sold_30d === 0 && p.stock > 0);
    const totalValue = products.reduce((sum, p) => sum + (p.price * p.stock), 0);
    return { lowStock, outOfStock, trending, slow, totalValue };
  }, [products]);

  const displayProducts = useMemo(() => {
    switch (view) {
      case 'low_stock': return stats.lowStock;
      case 'trending': return stats.trending;
      case 'slow': return stats.slow;
      default: return products.filter(p => p.status === 'active').sort((a, b) => a.stock - b.stock);
    }
  }, [view, products, stats]);

  const stockColor = (p: DbProduct) => {
    if (p.stock <= 0) return 'text-destructive';
    if (p.stock <= p.low_stock_threshold) return 'text-orange-500';
    return 'text-green-600';
  };

  const stockBg = (p: DbProduct) => {
    if (p.stock <= 0) return 'bg-destructive/10';
    if (p.stock <= p.low_stock_threshold) return 'bg-orange-50 dark:bg-orange-950/20';
    return 'bg-green-50 dark:bg-green-950/20';
  };

  const saveThreshold = async (p: DbProduct) => {
    try {
      await updateDbProduct(p.id, {
        low_stock_threshold: parseInt(editThreshold) || 5,
        restock_amount: parseInt(editRestock) || 50,
      });
      setEditingId(null);
      refetch();
      toast.success(sv ? 'Uppdaterad!' : 'Updated!');
    } catch { toast.error(sv ? 'Fel' : 'Error'); }
  };

  const suggestRestock = (p: DbProduct) => {
    if (p.units_sold_30d > 0) return Math.max(p.units_sold_30d * 2, 20);
    return p.restock_amount || 50;
  };

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => setView('overview')}>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <Package className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{sv ? 'Aktiva' : 'Active'}</span>
            </div>
            <p className="text-xl font-bold">{products.filter(p => p.status === 'active').length}</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-orange-300 transition-colors border-orange-200" onClick={() => setView('low_stock')}>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-orange-500" />
              <span className="text-xs text-orange-600">{sv ? 'Lågt lager' : 'Low Stock'}</span>
            </div>
            <p className="text-xl font-bold text-orange-600">{stats.lowStock.length}</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-destructive/30 transition-colors border-destructive/20" onClick={() => setView('overview')}>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <Flame className="w-4 h-4 text-destructive" />
              <span className="text-xs text-destructive">{sv ? 'Slut' : 'Out'}</span>
            </div>
            <p className="text-xl font-bold text-destructive">{stats.outOfStock.length}</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-green-300 transition-colors" onClick={() => setView('trending')}>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-green-600" />
              <span className="text-xs text-green-600">{sv ? 'Trendande' : 'Trending'}</span>
            </div>
            <p className="text-xl font-bold text-green-600">{stats.trending.length}</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-muted-foreground/30 transition-colors" onClick={() => setView('slow')}>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{sv ? 'Långsam' : 'Slow'}</span>
            </div>
            <p className="text-xl font-bold">{stats.slow.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Lagervärde */}
      <Card>
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{sv ? 'Totalt lagervärde' : 'Total inventory value'}</p>
            <p className="text-2xl font-bold">{stats.totalValue.toLocaleString('sv-SE')} SEK</p>
          </div>
          <BarChart3 className="w-8 h-8 text-muted-foreground/30" />
        </CardContent>
      </Card>

      {/* Product table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            {view === 'low_stock' && <><AlertTriangle className="w-4 h-4 text-orange-500" /> {sv ? 'Lågt lager – Beställ påfyllning' : 'Low Stock – Reorder Needed'}</>}
            {view === 'trending' && <><TrendingUp className="w-4 h-4 text-green-600" /> {sv ? 'Trendande produkter' : 'Trending Products'}</>}
            {view === 'slow' && <><TrendingDown className="w-4 h-4 text-muted-foreground" /> {sv ? 'Långsamma produkter' : 'Slow Moving Products'}</>}
            {view === 'overview' && <><Package className="w-4 h-4" /> {sv ? 'Alla aktiva produkter' : 'All Active Products'}</>}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">{sv ? 'Produkt' : 'Product'}</th>
                  <th className="text-center p-3 font-medium">{sv ? 'Lager' : 'Stock'}</th>
                  <th className="text-center p-3 font-medium hidden sm:table-cell">{sv ? 'Tröskel' : 'Threshold'}</th>
                  <th className="text-center p-3 font-medium hidden md:table-cell">{sv ? '7d försäljning' : '7d Sales'}</th>
                  <th className="text-center p-3 font-medium hidden md:table-cell">{sv ? '30d försäljning' : '30d Sales'}</th>
                  <th className="text-center p-3 font-medium">{sv ? 'Förslag' : 'Suggestion'}</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {displayProducts.map(p => {
                  const isEditing = editingId === p.id;
                  return (
                    <tr key={p.id} className={`border-b border-border/50 ${stockBg(p)}`}>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          {p.image_urls?.[0] && (
                            <img src={p.image_urls[0]} alt="" className="w-8 h-8 rounded object-cover" />
                          )}
                          <div>
                            <p className="font-medium text-xs truncate max-w-[180px]">{p.title_sv}</p>
                            <p className="text-[10px] text-muted-foreground">{p.category || '–'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <span className={`font-bold text-sm ${stockColor(p)}`}>{p.stock}</span>
                      </td>
                      <td className="p-3 text-center hidden sm:table-cell">
                        {isEditing ? (
                          <Input
                            value={editThreshold}
                            onChange={e => setEditThreshold(e.target.value)}
                            className="h-7 w-14 text-xs text-center mx-auto"
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">{p.low_stock_threshold}</span>
                        )}
                      </td>
                      <td className="p-3 text-center hidden md:table-cell">
                        <div className="flex items-center justify-center gap-1">
                          <span className="text-xs">{p.units_sold_7d}</span>
                          {p.units_sold_7d >= 5 && <TrendingUp className="w-3 h-3 text-green-600" />}
                        </div>
                      </td>
                      <td className="p-3 text-center hidden md:table-cell">
                        <span className="text-xs">{p.units_sold_30d}</span>
                      </td>
                      <td className="p-3 text-center">
                        {p.stock <= p.low_stock_threshold ? (
                          <Badge variant="outline" className="text-[10px] border-orange-300 text-orange-600">
                            <RefreshCw className="w-3 h-3 mr-1" />
                            {sv ? `Beställ ${suggestRestock(p)} st` : `Order ${suggestRestock(p)} units`}
                          </Badge>
                        ) : p.units_sold_7d >= 5 ? (
                          <Badge variant="outline" className="text-[10px] border-green-300 text-green-600">
                            <TrendingUp className="w-3 h-3 mr-1" />
                            {sv ? 'Trendande' : 'Trending'}
                          </Badge>
                        ) : p.units_sold_30d === 0 && p.stock > 0 ? (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            <TrendingDown className="w-3 h-3 mr-1" />
                            {sv ? 'Långsam' : 'Slow'}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">OK</span>
                        )}
                      </td>
                      <td className="p-3">
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => saveThreshold(p)}>
                              <Save className="w-3 h-3 text-green-600" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm" variant="ghost" className="h-7 text-[10px]"
                            onClick={() => { setEditingId(p.id); setEditThreshold(p.low_stock_threshold.toString()); setEditRestock(p.restock_amount.toString()); }}
                          >
                            {sv ? 'Ändra' : 'Edit'}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {displayProducts.length === 0 && (
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground text-sm">
                    {sv ? 'Inga produkter i denna vy' : 'No products in this view'}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminStockIntelligence;
