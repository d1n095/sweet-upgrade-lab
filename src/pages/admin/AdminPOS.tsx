import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  Search, Plus, Minus, Trash2, ShoppingCart, Banknote, Smartphone,
  CreditCard, Loader2, CheckCircle2, Receipt,
} from 'lucide-react';

interface CartItem {
  id: string;
  title: string;
  price: number;
  quantity: number;
  image: string;
  stock: number;
}

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Kontant', icon: Banknote },
  { value: 'swish', label: 'Swish', icon: Smartphone },
  { value: 'card_manual', label: 'Kort (manuell)', icon: CreditCard },
] as const;

const AdminPOS = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [customerEmail, setCustomerEmail] = useState('');
  const [processing, setProcessing] = useState(false);
  const [lastOrder, setLastOrder] = useState<{ id: string; number: string; total: number } | null>(null);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['pos-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, title_sv, price, stock, reserved_stock, allow_overselling, image_urls, is_visible')
        .eq('is_visible', true)
        .order('title_sv');
      if (error) throw error;
      return data || [];
    },
    staleTime: 30_000,
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter((p: any) => p.title_sv?.toLowerCase().includes(q));
  }, [products, search]);

  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === product.id);
      if (existing) {
        return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, {
        id: product.id,
        title: product.title_sv,
        price: product.price,
        quantity: 1,
        image: product.image_urls?.[0] || '',
        stock: product.stock - (product.reserved_stock || 0),
      }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.id !== id) return i;
      const newQty = Math.max(0, i.quantity + delta);
      return newQty === 0 ? i : { ...i, quantity: newQty };
    }).filter(i => i.quantity > 0));
  };

  const removeItem = (id: string) => setCart(prev => prev.filter(i => i.id !== id));

  const subtotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const itemCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  const completeOrder = async () => {
    if (cart.length === 0) return toast.error('Kundvagnen är tom');
    setProcessing(true);
    try {
      const userId = user?.id || '00000000-0000-0000-0000-000000000000';
      const email = customerEmail.trim() || user?.email || 'pos@store.local';

      const orderItems = cart.map(i => ({
        id: i.id,
        title: i.title,
        price: i.price,
        quantity: i.quantity,
        image: i.image,
      }));

      const { data: order, error } = await supabase
        .from('orders')
        .insert({
          order_email: email,
          user_id: userId,
          total_amount: subtotal,
          currency: 'SEK',
          status: 'confirmed',
          payment_status: 'paid',
          payment_method: paymentMethod,
          fulfillment_status: 'unfulfilled',
          delivery_method: 'pickup',
          items: orderItems,
          shipping_address: { name: 'POS', address: 'Butik', zip: '', city: '', country: 'SE', phone: '' },
          status_history: [{
            status: 'confirmed',
            timestamp: new Date().toISOString(),
            note: `POS-order skapad av ${user?.email || 'admin'} — ${PAYMENT_METHODS.find(m => m.value === paymentMethod)?.label || paymentMethod}`,
          }],
          notes: `POS — ${PAYMENT_METHODS.find(m => m.value === paymentMethod)?.label || paymentMethod}`,
        })
        .select('id, order_number')
        .single();

      if (error) throw error;

      // Deduct stock for each item
      for (const item of cart) {
        const prod = products.find((p: any) => p.id === item.id);
        if (prod) {
          await supabase
            .from('products')
            .update({ stock: Math.max(0, (prod as any).stock - item.quantity) })
            .eq('id', item.id);
        }
      }

      // Log activity
      await supabase.from('activity_logs').insert({
        log_type: 'success',
        category: 'order',
        message: `POS-order skapad: ${subtotal} SEK (${paymentMethod})`,
        details: { order_id: order.id, payment_method: paymentMethod, items: orderItems.length, total: subtotal },
        order_id: order.id,
        user_id: userId !== '00000000-0000-0000-0000-000000000000' ? userId : null,
      });

      // Invalidate admin queries so stats update
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['pos-products'] });

      setLastOrder({ id: order.id, number: order.order_number || order.id.slice(0, 8), total: subtotal });
      setCart([]);
      setCustomerEmail('');
      toast.success(`Order skapad — ${subtotal} kr`);
    } catch (err: any) {
      console.error('POS order error:', err);
      toast.error('Kunde inte skapa order: ' + (err?.message || 'Okänt fel'));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="p-4 md:p-8 mt-14 md:mt-0 space-y-6">
      <div className="flex items-center gap-3">
        <Receipt className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold">Kassa (POS)</h1>
      </div>

      {/* Success banner */}
      {lastOrder && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="flex items-center gap-4 py-4">
            <CheckCircle2 className="w-8 h-8 text-green-500 shrink-0" />
            <div>
              <p className="font-semibold text-green-700 dark:text-green-400">
                Order #{lastOrder.number} skapad — {lastOrder.total} kr
              </p>
              <p className="text-xs text-muted-foreground">Ordern syns nu i statistik och orderlistan</p>
            </div>
            <Button variant="outline" size="sm" className="ml-auto" onClick={() => setLastOrder(null)}>
              Stäng
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Product picker — 3 cols */}
        <div className="lg:col-span-3 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Produkter</CardTitle>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Sök produkt..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
              ) : filtered.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Inga produkter hittades</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[500px] overflow-y-auto pr-1">
                  {filtered.map((product: any) => {
                    const available = product.stock - (product.reserved_stock || 0);
                    const inCart = cart.find(i => i.id === product.id);
                    return (
                      <button
                        key={product.id}
                        onClick={() => addToCart(product)}
                        className="flex flex-col items-start gap-2 p-3 rounded-xl border border-border bg-card hover:bg-accent/50 transition-colors text-left relative"
                      >
                        {product.image_urls?.[0] && (
                          <img
                            src={product.image_urls[0]}
                            alt={product.title_sv}
                            className="w-full h-20 object-contain rounded-lg bg-muted"
                          />
                        )}
                        <span className="text-sm font-medium line-clamp-2 leading-tight">{product.title_sv}</span>
                        <div className="flex items-center justify-between w-full">
                          <span className="text-sm font-bold text-primary">{product.price} kr</span>
                          <Badge variant={available > 5 ? 'secondary' : available > 0 ? 'outline' : 'destructive'} className="text-[10px]">
                            {available > 0 ? `${available} st` : 'Slut'}
                          </Badge>
                        </div>
                        {inCart && (
                          <Badge className="absolute top-2 right-2 bg-primary text-primary-foreground text-[10px]">
                            {inCart.quantity}
                          </Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Cart — 2 cols */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" />
                Kundvagn ({itemCount})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {cart.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">Lägg till produkter från listan</p>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {cart.map(item => (
                    <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg border border-border">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.price} kr/st</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.id, -1)}>
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.id, 1)}>
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                      <span className="text-sm font-semibold w-16 text-right">{item.price * item.quantity} kr</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeItem(item.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {cart.length > 0 && (
                <>
                  <Separator />
                  <div className="flex justify-between items-center text-lg font-bold">
                    <span>Totalt</span>
                    <span className="text-primary">{subtotal} kr</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Payment section */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Betalning</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Betalmetod</label>
                <div className="grid grid-cols-3 gap-2">
                  {PAYMENT_METHODS.map(method => (
                    <button
                      key={method.value}
                      onClick={() => setPaymentMethod(method.value)}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-colors ${
                        paymentMethod === method.value
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-border hover:border-muted-foreground/30'
                      }`}
                    >
                      <method.icon className="w-5 h-5" />
                      <span className="text-xs font-medium">{method.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Kund-email (valfritt)</label>
                <Input
                  type="email"
                  placeholder="kund@example.com"
                  value={customerEmail}
                  onChange={e => setCustomerEmail(e.target.value)}
                />
              </div>

              <Button
                onClick={completeOrder}
                disabled={cart.length === 0 || processing}
                className="w-full h-14 text-lg font-bold"
                size="lg"
              >
                {processing ? (
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 mr-2" />
                )}
                {processing ? 'Skapar order...' : `Slutför — ${subtotal} kr`}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminPOS;
