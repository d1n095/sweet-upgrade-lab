import { useState } from 'react';
import { Truck, Loader2, Home, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { safeInvoke } from '@/lib/safeInvoke';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { logActivity } from '@/utils/activityLogger';
import { getOrderDisplayId } from '@/utils/orderDisplay';

interface ShippingFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: { id: string; order_email: string; status_history: any; [key: string]: any } | null;
  onShipped: (orderId: string, data: { carrier: string; tracking_number: string; tracking_url: string | null; delivery_method?: string }) => void;
}

const CARRIERS = [
  { value: 'postnord', label: 'PostNord', trackingBase: 'https://tracking.postnord.com/tracking.html?id=' },
  { value: 'dhl', label: 'DHL', trackingBase: 'https://www.dhl.com/se-sv/home/tracking.html?tracking-id=' },
  { value: 'bring', label: 'Bring', trackingBase: 'https://tracking.bring.se/tracking/' },
  { value: 'budbee', label: 'Budbee', trackingBase: '' },
  { value: 'other', label: 'Annat', trackingBase: '' },
];

type DeliveryMethod = 'shipping' | 'pickup' | 'local_delivery';

const DELIVERY_OPTIONS: { value: DeliveryMethod; label: string; icon: typeof Truck; description: string }[] = [
  { value: 'shipping', label: 'Skicka med frakt', icon: Truck, description: 'Kräver spårningsnummer' },
  { value: 'local_delivery', label: 'Leverera själv', icon: Home, description: 'Ingen spårning krävs' },
  { value: 'pickup', label: 'Upphämtad', icon: Package, description: 'Kunden hämtar på plats' },
];

const ShippingFormDialog = ({ open, onOpenChange, order, onShipped }: ShippingFormDialogProps) => {
  const { user } = useAuth();
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('shipping');
  const [carrier, setCarrier] = useState('postnord');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const selectedCarrier = CARRIERS.find(c => c.value === carrier);
  const requiresTracking = deliveryMethod === 'shipping';

  const autoUrl = selectedCarrier?.trackingBase && trackingNumber
    ? `${selectedCarrier.trackingBase}${trackingNumber}`
    : '';

  const handleSubmit = async () => {
    if (!order || !user) return;
    if (requiresTracking && !trackingNumber.trim()) {
      toast.error('Ange ett spårningsnummer');
      return;
    }

    setIsSaving(true);
    try {
      const finalUrl = trackingUrl.trim() || autoUrl || null;
      const existingHistory = Array.isArray(order.status_history) ? order.status_history : [];

      const noteText = deliveryMethod === 'shipping'
        ? `Skickad via ${selectedCarrier?.label || carrier}. Spårning: ${trackingNumber.trim()}`
        : deliveryMethod === 'local_delivery'
        ? 'Levererad lokalt'
        : 'Upphämtad av kund';

      const newHistory = [
        ...existingHistory,
        {
          status: deliveryMethod === 'shipping' ? 'shipped' : 'delivered',
          timestamp: new Date().toISOString(),
          note: noteText,
        },
      ];

      const isDirectDelivery = deliveryMethod !== 'shipping';

      const updateData: Record<string, any> = {
        fulfillment_status: isDirectDelivery ? 'delivered' : 'shipped',
        status: isDirectDelivery ? 'delivered' : 'shipped',
        delivery_method: deliveryMethod,
        delivery_status: isDirectDelivery ? 'delivered' : 'pending',
        shipped_at: new Date().toISOString(),
        shipped_by: user.id,
        status_history: newHistory,
      };

      if (requiresTracking) {
        updateData.tracking_number = trackingNumber.trim();
        updateData.shipping_method = carrier;
      }

      if (isDirectDelivery) {
        updateData.delivered_at = new Date().toISOString();
      }

      const { error } = await supabase.from('orders').update(updateData).eq('id', order.id);
      if (error) throw error;

      await logActivity({
        log_type: 'success',
        category: 'fulfillment',
        message: `Order ${deliveryMethod === 'shipping' ? 'skickad via ' + (selectedCarrier?.label || carrier) : deliveryMethod === 'pickup' ? 'upphämtad' : 'levererad lokalt'}`,
        details: {
          delivery_method: deliveryMethod,
          ...(requiresTracking ? { tracking_number: trackingNumber.trim(), carrier, tracking_url: finalUrl } : {}),
        },
        order_id: order.id,
      });

      // Send notification email for shipping
      let emailSent = false;
      if (deliveryMethod === 'shipping') {
        try {
          const { error: emailError } = await safeInvoke('send-order-email', {
            body: { order_id: order.id, email_type: 'status_update' },
          });
          emailSent = !emailError;
        } catch {}
      }

      onShipped(order.id, {
        carrier: requiresTracking ? carrier : deliveryMethod,
        tracking_number: requiresTracking ? trackingNumber.trim() : '',
        tracking_url: requiresTracking ? finalUrl : null,
        delivery_method: deliveryMethod,
      });

      const successMsg = deliveryMethod === 'shipping'
        ? (emailSent ? 'Order skickad ✓ Mail skickat till kund' : 'Order skickad ✓')
        : deliveryMethod === 'pickup'
        ? 'Order markerad som upphämtad ✓'
        : 'Order markerad som levererad ✓';

      toast.success(successMsg);
      onOpenChange(false);
      setTrackingNumber('');
      setTrackingUrl('');
      setCarrier('postnord');
      setDeliveryMethod('shipping');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Kunde inte uppdatera order');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-primary" />
            Leveransmetod
          </DialogTitle>
        </DialogHeader>

        {order && (
          <p className="text-sm text-muted-foreground">
            Order: <span className="font-mono font-medium">{getOrderDisplayId(order)}</span> — {order.order_email}
          </p>
        )}

        <div className="space-y-4">
          {/* Delivery method selection */}
          <div className="space-y-2">
            <Label>Leveransmetod</Label>
            <div className="grid grid-cols-1 gap-2">
              {DELIVERY_OPTIONS.map(opt => {
                const Icon = opt.icon;
                const isActive = deliveryMethod === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setDeliveryMethod(opt.value)}
                    className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                      isActive
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-border hover:bg-muted/50'
                    }`}
                  >
                    <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                    <div>
                      <p className={`text-sm font-medium ${isActive ? 'text-primary' : ''}`}>{opt.label}</p>
                      <p className="text-xs text-muted-foreground">{opt.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Shipping-specific fields */}
          {requiresTracking && (
            <>
              <div className="space-y-2">
                <Label>Fraktbolag</Label>
                <Select value={carrier} onValueChange={setCarrier}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CARRIERS.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Spårningsnummer *</Label>
                <Input
                  placeholder="T.ex. 00123456789SE"
                  value={trackingNumber}
                  onChange={e => setTrackingNumber(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label>Spårningslänk (valfri)</Label>
                <Input
                  placeholder={autoUrl || 'https://...'}
                  value={trackingUrl}
                  onChange={e => setTrackingUrl(e.target.value)}
                />
                {autoUrl && !trackingUrl && (
                  <p className="text-xs text-muted-foreground">
                    Auto-genererad: <span className="font-mono">{autoUrl.slice(0, 60)}…</span>
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Avbryt
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSaving || (requiresTracking && !trackingNumber.trim())}
          >
            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            {deliveryMethod === 'shipping' ? 'Markera som skickad' : deliveryMethod === 'pickup' ? 'Markera som upphämtad' : 'Markera som levererad'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ShippingFormDialog;
