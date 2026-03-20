import { useState, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import {
  ScanLine, Package, CheckCircle2, AlertTriangle, X, Printer,
  QrCode, Truck, Loader2, Camera,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { logActivity } from '@/utils/activityLogger';
import { getOrderDisplayId } from '@/utils/orderDisplay';

interface PackingOrder {
  id: string;
  order_email: string;
  total_amount: number;
  items: any;
  shipping_address: any;
  payment_intent_id: string | null;
  stripe_session_id: string | null;
  fulfillment_status: string;
  created_at: string;
  tracking_number: string | null;
}

const ScanPackingMode = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [scanInput, setScanInput] = useState('');
  const [activeOrder, setActiveOrder] = useState<PackingOrder | null>(null);
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});
  const [trackingNumber, setTrackingNumber] = useState('');
  const [isPacking, setIsPacking] = useState(false);
  const [isShipping, setIsShipping] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus scan input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Fetch orders ready to pack
  const { data: packQueue = [] } = useQuery({
    queryKey: ['pack-queue'],
    queryFn: async () => {
      const { data } = await supabase
        .from('orders')
        .select('id, order_email, total_amount, items, shipping_address, payment_intent_id, stripe_session_id, fulfillment_status, created_at, tracking_number')
        .eq('payment_status', 'paid')
        .in('fulfillment_status', ['pending', 'unfulfilled'])
        .is('deleted_at', null)
        .order('created_at', { ascending: true });
      return (data || []) as PackingOrder[];
    },
    refetchInterval: 10000,
  });

  const handleScan = async () => {
    const query = scanInput.trim();
    if (!query) return;
    setScanError(null);

    // Search by order ID, payment_intent, stripe_session, or email
    const { data } = await supabase
      .from('orders')
      .select('id, order_email, total_amount, items, shipping_address, payment_intent_id, stripe_session_id, fulfillment_status, created_at, tracking_number')
      .eq('payment_status', 'paid')
      .is('deleted_at', null)
      .or(`id.eq.${query},payment_intent_id.eq.${query},stripe_session_id.eq.${query},order_email.ilike.%${query}%`)
      .limit(1)
      .maybeSingle();

    if (!data) {
      setScanError('Ingen order hittades');
      toast.error('Ingen order hittades för denna sökning');
      return;
    }

    setActiveOrder(data as PackingOrder);
    setCheckedItems({});
    setTrackingNumber(data.tracking_number || '');
    setScanInput('');
  };

  const orderItems = activeOrder?.items
    ? (Array.isArray(activeOrder.items) ? activeOrder.items : [])
    : [];

  const allChecked = orderItems.length > 0 && orderItems.every((_, i) => checkedItems[i]);

  const handleMarkPacked = async () => {
    if (!activeOrder || !user) return;
    setIsPacking(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          fulfillment_status: 'packed',
          packed_at: new Date().toISOString(),
          packed_by: user.id,
        })
        .eq('id', activeOrder.id);

      if (error) throw error;

      await logActivity({
        log_type: 'fulfillment',
        category: 'order',
        message: `Order packad via scan`,
        order_id: activeOrder.id,
        user_id: user.id,
      });

      toast.success('Order markerad som packad ✓');
      setActiveOrder(null);
      setCheckedItems({});
      queryClient.invalidateQueries({ queryKey: ['pack-queue'] });
    } catch (err: any) {
      toast.error(err.message || 'Kunde inte uppdatera order');
    } finally {
      setIsPacking(false);
    }
  };

  const handleMarkShipped = async () => {
    if (!activeOrder || !user) return;
    setIsShipping(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          fulfillment_status: 'shipped',
          shipped_at: new Date().toISOString(),
          shipped_by: user.id,
          tracking_number: trackingNumber || null,
        })
        .eq('id', activeOrder.id);

      if (error) throw error;

      await logActivity({
        log_type: 'fulfillment',
        category: 'order',
        message: `Order skickad via scan`,
        order_id: activeOrder.id,
        user_id: user.id,
        details: { tracking_number: trackingNumber },
      });

      toast.success('Order markerad som skickad ✓');
      setActiveOrder(null);
      setCheckedItems({});
      setTrackingNumber('');
      queryClient.invalidateQueries({ queryKey: ['pack-queue'] });
    } catch (err: any) {
      toast.error(err.message || 'Kunde inte uppdatera order');
    } finally {
      setIsShipping(false);
    }
  };

  const generateLabel = () => {
    if (!activeOrder) return;
    const addr = activeOrder.shipping_address;
    const labelData = {
      to: {
        name: addr?.name || '',
        address: addr?.address || '',
        zip: addr?.zip || '',
        city: addr?.city || '',
        country: addr?.country || 'SE',
      },
      orderId: getOrderDisplayId(activeOrder as any),
      items: orderItems.length,
    };
    
    // Create printable label
    const w = window.open('', '_blank', 'width=400,height=600');
    if (w) {
      w.document.write(`
        <html><head><title>Fraktetikett</title>
        <style>
          body { font-family: system-ui; padding: 20px; }
          .label { border: 2px solid #000; padding: 20px; max-width: 350px; }
          .barcode { font-family: monospace; font-size: 14px; letter-spacing: 2px; margin: 10px 0; padding: 8px; background: #f5f5f5; text-align: center; }
          h2 { margin: 0 0 10px; }
          .addr { margin: 15px 0; line-height: 1.6; }
          .footer { margin-top: 15px; font-size: 12px; color: #666; }
        </style></head><body>
        <div class="label">
          <h2>📦 Fraktetikett</h2>
          <div class="barcode">${activeOrder.payment_intent_id || activeOrder.id.slice(0, 12)}</div>
          <div class="addr">
            <strong>${labelData.to.name}</strong><br/>
            ${labelData.to.address}<br/>
            ${labelData.to.zip} ${labelData.to.city}<br/>
            ${labelData.to.country}
          </div>
          <div class="footer">
            Order: ${getOrderDisplayId(activeOrder as any)}<br/>
            Antal artiklar: ${labelData.items}<br/>
            Datum: ${new Date().toLocaleDateString('sv-SE')}
          </div>
        </div>
        <script>window.onload = () => window.print();</script>
        </body></html>
      `);
      w.document.close();
    }
  };

  return (
    <div className="space-y-6">
      {/* Scan bar */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ScanLine className="w-5 h-5 text-primary" />
            Scan / Sök order
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              placeholder="Scanna QR/streckkod eller sök order-ID, email…"
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleScan()}
              className="flex-1"
            />
            <Button onClick={handleScan} variant="default">
              <QrCode className="w-4 h-4 mr-2" />
              Sök
            </Button>
          </div>
          {scanError && (
            <p className="text-sm text-destructive mt-2 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> {scanError}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: Pack queue */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Att packa
                </span>
                <Badge variant="secondary">{packQueue.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[500px] overflow-auto">
              {packQueue.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Inga orders att packa 🎉</p>
              ) : (
                packQueue.map((order) => (
                  <button
                    key={order.id}
                    onClick={() => {
                      setActiveOrder(order);
                      setCheckedItems({});
                      setTrackingNumber(order.tracking_number || '');
                    }}
                    className={cn(
                      'w-full text-left p-3 rounded-lg border transition-colors',
                      activeOrder?.id === order.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/40'
                    )}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-mono text-muted-foreground">
                          {getOrderDisplayId(order as any)}
                        </p>
                        <p className="text-sm truncate">{order.order_email}</p>
                      </div>
                      <span className="text-xs font-semibold">
                        {order.total_amount.toLocaleString('sv-SE')} kr
                      </span>
                    </div>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Active order packing */}
        <div className="lg:col-span-2">
          {!activeOrder ? (
            <Card>
              <CardContent className="py-16 text-center">
                <ScanLine className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">Scanna eller välj en order för att starta packning</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Package className="w-5 h-5 text-primary" />
                    {getOrderDisplayId(activeOrder as any)}
                  </CardTitle>
                  <div className="flex gap-2">
                    <Badge variant={activeOrder.fulfillment_status === 'packed' ? 'default' : 'secondary'}>
                      {activeOrder.fulfillment_status}
                    </Badge>
                    <Button variant="ghost" size="icon" onClick={() => setActiveOrder(null)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{activeOrder.order_email}</p>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Shipping address */}
                {activeOrder.shipping_address && (
                  <div className="bg-secondary/30 rounded-lg p-3 text-sm">
                    <p className="font-medium mb-1">Leveransadress:</p>
                    <p>{(activeOrder.shipping_address as any)?.name}</p>
                    <p>{(activeOrder.shipping_address as any)?.address}</p>
                    <p>{(activeOrder.shipping_address as any)?.zip} {(activeOrder.shipping_address as any)?.city}</p>
                  </div>
                )}

                {/* Items checklist */}
                <div>
                  <p className="text-sm font-medium mb-2">Artiklar att packa:</p>
                  <div className="space-y-2">
                    {orderItems.map((item: any, idx: number) => (
                      <div
                        key={idx}
                        className={cn(
                          'flex items-center gap-3 p-3 rounded-lg border transition-colors',
                          checkedItems[idx]
                            ? 'border-accent bg-accent/5'
                            : 'border-border'
                        )}
                      >
                        <Checkbox
                          checked={!!checkedItems[idx]}
                          onCheckedChange={(v) => setCheckedItems(prev => ({ ...prev, [idx]: !!v }))}
                        />
                        {item.image && (
                          <img src={item.image} alt="" className="w-10 h-10 rounded object-cover" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className={cn('text-sm font-medium', checkedItems[idx] && 'line-through text-muted-foreground')}>
                            {item.title}
                          </p>
                          <p className="text-xs text-muted-foreground">Antal: {item.quantity}</p>
                        </div>
                        {checkedItems[idx] && (
                          <CheckCircle2 className="w-5 h-5 text-accent shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {Object.values(checkedItems).filter(Boolean).length} / {orderItems.length} artiklar verifierade
                  </p>
                </div>

                <Separator />

                {/* Tracking number */}
                <div>
                  <label className="text-sm font-medium mb-1 block">Spårningsnummer</label>
                  <Input
                    placeholder="Ange spårningsnummer…"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                  />
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 pt-2">
                  {activeOrder.fulfillment_status !== 'packed' && activeOrder.fulfillment_status !== 'shipped' && (
                    <Button
                      onClick={handleMarkPacked}
                      disabled={!allChecked || isPacking}
                      className="flex-1"
                    >
                      {isPacking ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                      )}
                      Markera som packad
                    </Button>
                  )}

                  {(activeOrder.fulfillment_status === 'packed' || allChecked) && activeOrder.fulfillment_status !== 'shipped' && (
                    <Button
                      onClick={handleMarkShipped}
                      disabled={isShipping}
                      variant="default"
                      className="flex-1"
                    >
                      {isShipping ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Truck className="w-4 h-4 mr-2" />
                      )}
                      Markera som skickad
                    </Button>
                  )}

                  <Button variant="outline" onClick={generateLabel}>
                    <Printer className="w-4 h-4 mr-2" />
                    Skriv ut etikett
                  </Button>
                </div>

                {!allChecked && activeOrder.fulfillment_status !== 'packed' && (
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Markera alla artiklar som verifierade innan du kan packa
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScanPackingMode;
