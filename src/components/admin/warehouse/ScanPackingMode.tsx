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
import { Progress } from '@/components/ui/progress';
import {
  ScanLine, Package, CheckCircle2, AlertTriangle, X,
  QrCode, Truck, Loader2, XCircle, ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { logActivity } from '@/utils/activityLogger';
import { getOrderDisplayId } from '@/utils/orderDisplay';
import ShippingFormDialog from '@/components/admin/ShippingFormDialog';

interface PackingOrder {
  id: string;
  order_email: string;
  total_amount: number;
  items: any;
  shipping_address: any;
  payment_intent_id: string | null;
  stripe_session_id: string | null;
  fulfillment_status: string;
  payment_status: string;
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
  const [scanSuccess, setScanSuccess] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const { data: packQueue = [] } = useQuery({
    queryKey: ['pack-queue'],
    queryFn: async () => {
      const { data } = await supabase
        .from('orders')
        .select('id, order_email, total_amount, items, shipping_address, payment_intent_id, stripe_session_id, fulfillment_status, payment_status, created_at, tracking_number')
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
    setScanSuccess(null);

    const { data } = await supabase
      .from('orders')
      .select('id, order_email, total_amount, items, shipping_address, payment_intent_id, stripe_session_id, fulfillment_status, payment_status, created_at, tracking_number')
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

    // Block if not paid
    if ((data as any).payment_status !== 'paid') {
      setScanError('Order ej betald – kan inte packas');
      toast.error('Order ej betald');
      return;
    }

    setScanSuccess(`Order ${getOrderDisplayId(data as any)} hittad`);
    setActiveOrder(data as PackingOrder);
    setCheckedItems({});
    setTrackingNumber(data.tracking_number || '');
    setScanInput('');
  };

  const orderItems = activeOrder?.items
    ? (Array.isArray(activeOrder.items) ? activeOrder.items : [])
    : [];

  const checkedCount = Object.values(checkedItems).filter(Boolean).length;
  const allChecked = orderItems.length > 0 && orderItems.every((_, i) => checkedItems[i]);
  const progressPercent = orderItems.length > 0 ? (checkedCount / orderItems.length) * 100 : 0;

  const handleCheckItem = (idx: number, productTitle: string, checked: boolean) => {
    setCheckedItems(prev => ({ ...prev, [idx]: checked }));
    if (checked) {
      setScanSuccess(`✓ ${productTitle}`);
      setScanError(null);
    }
  };

  const handlePackAndShip = async () => {
    if (!activeOrder || !user) return;
    if (activeOrder.payment_status !== 'paid') {
      toast.error('Kan inte packa – order ej betald');
      return;
    }
    if (activeOrder.fulfillment_status === 'shipped' || (activeOrder.fulfillment_status === 'packed' && activeOrder.tracking_number)) {
      toast.error('Frakt redan skapad');
      return;
    }
    setIsPacking(true);
    try {
      toast.loading('Skapar frakt…', { id: `ship-${activeOrder.id}` });
      const { data, error } = await supabase.functions.invoke('create-shipment', {
        body: { order_id: activeOrder.id },
      });
      toast.dismiss(`ship-${activeOrder.id}`);
      if (error) throw new Error(error.message || 'Edge function error');
      if (!data?.success) throw new Error(data?.error || 'Unknown error');

      if (data.label_url) window.open(data.label_url, '_blank');

      toast.success(data.shipmondo_used ? 'Packad & frakt skapad ✓' : 'Packad ✓ (Shipmondo ej konfigurerad)');
      setActiveOrder(null);
      setCheckedItems({});
      setScanSuccess(null);
      setTrackingNumber(data.tracking_number || '');
      queryClient.invalidateQueries({ queryKey: ['pack-queue'] });
      inputRef.current?.focus();
    } catch (err: any) {
      toast.dismiss(`ship-${activeOrder.id}`);
      toast.error(err.message || 'Kunde inte skapa frakt');
    } finally {
      setIsPacking(false);
    }
  };

  const handleMarkShipped = async () => {
    if (!activeOrder || !user) return;
    if (activeOrder.fulfillment_status !== 'packed') {
      toast.error('Packa ordern först');
      return;
    }
    setIsShipping(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          fulfillment_status: 'shipped',
          shipped_at: new Date().toISOString(),
          shipped_by: user.id,
        })
        .eq('id', activeOrder.id);

      if (error) throw error;

      await logActivity({
        log_type: 'success',
        category: 'fulfillment',
        message: `Order skickad`,
        order_id: activeOrder.id,
      });

      toast.success('Order markerad som skickad ✓');
      setActiveOrder(null);
      setCheckedItems({});
      setTrackingNumber('');
      setScanSuccess(null);
      queryClient.invalidateQueries({ queryKey: ['pack-queue'] });
      inputRef.current?.focus();
    } catch (err: any) {
      toast.error(err.message || 'Kunde inte uppdatera order');
    } finally {
      setIsShipping(false);
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
        <CardContent className="space-y-2">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              placeholder="Scanna QR/streckkod eller sök order-ID, email…"
              value={scanInput}
              onChange={(e) => { setScanInput(e.target.value); setScanError(null); setScanSuccess(null); }}
              onKeyDown={(e) => e.key === 'Enter' && handleScan()}
              className="flex-1"
            />
            <Button onClick={handleScan} variant="default">
              <QrCode className="w-4 h-4 mr-2" />
              Sök
            </Button>
          </div>
          {scanError && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
              <XCircle className="w-4 h-4 shrink-0" /> {scanError}
            </div>
          )}
          {scanSuccess && !scanError && (
            <div className="flex items-center gap-2 text-sm text-accent bg-accent/10 rounded-lg px-3 py-2">
              <ShieldCheck className="w-4 h-4 shrink-0" /> {scanSuccess}
            </div>
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
                      setScanError(null);
                      setScanSuccess(`Order ${getOrderDisplayId(order as any)} vald`);
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
                    <Button variant="ghost" size="icon" onClick={() => { setActiveOrder(null); setScanSuccess(null); }}>
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

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Packningsframsteg</span>
                    <span className="font-medium">{checkedCount} / {orderItems.length}</span>
                  </div>
                  <Progress value={progressPercent} className="h-2" />
                </div>

                {/* Items checklist */}
                <div>
                  <p className="text-sm font-medium mb-2">Artiklar att packa:</p>
                  <div className="space-y-2">
                    {orderItems.map((item: any, idx: number) => (
                      <div
                        key={idx}
                        className={cn(
                          'flex items-center gap-3 p-3 rounded-lg border transition-all',
                          checkedItems[idx]
                            ? 'border-accent bg-accent/5'
                            : 'border-border'
                        )}
                      >
                        <Checkbox
                          checked={!!checkedItems[idx]}
                          onCheckedChange={(v) => handleCheckItem(idx, item.title || `Artikel ${idx + 1}`, !!v)}
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
                </div>

                <Separator />

                {/* Tracking number – populated automatically by Shipmondo API */}
                {trackingNumber && (
                  <div className="bg-accent/10 rounded-lg p-3 text-sm">
                    <p className="font-medium mb-1">Spårningsnummer:</p>
                    <p className="font-mono">{trackingNumber}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap gap-2 pt-2">
                  {activeOrder.fulfillment_status !== 'packed' && activeOrder.fulfillment_status !== 'shipped' && (
                    <Button
                      onClick={handlePackAndShip}
                      disabled={!allChecked || isPacking}
                      className="flex-1"
                    >
                      {isPacking ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Package className="w-4 h-4 mr-2" />
                      )}
                      Packa & skapa frakt
                    </Button>
                  )}

                  {activeOrder.fulfillment_status === 'packed' && (
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
                </div>

                {!allChecked && activeOrder.fulfillment_status !== 'packed' && (
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Verifiera alla artiklar innan du kan markera som packad
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