import { useState } from 'react';
import { Truck, Loader2 } from 'lucide-react';
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
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { logActivity } from '@/utils/activityLogger';
import { getOrderDisplayId } from '@/utils/orderDisplay';

interface ShippingFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: { id: string; order_email: string; status_history: any; [key: string]: any } | null;
  onShipped: (orderId: string, data: { carrier: string; tracking_number: string; tracking_url: string | null }) => void;
}

const CARRIERS = [
  { value: 'postnord', label: 'PostNord', trackingBase: 'https://tracking.postnord.com/tracking.html?id=' },
  { value: 'dhl', label: 'DHL', trackingBase: 'https://www.dhl.com/se-sv/home/tracking.html?tracking-id=' },
  { value: 'bring', label: 'Bring', trackingBase: 'https://tracking.bring.se/tracking/' },
  { value: 'budbee', label: 'Budbee', trackingBase: '' },
  { value: 'other', label: 'Annat', trackingBase: '' },
];

const ShippingFormDialog = ({ open, onOpenChange, order, onShipped }: ShippingFormDialogProps) => {
  const { user } = useAuth();
  const [carrier, setCarrier] = useState('postnord');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const selectedCarrier = CARRIERS.find(c => c.value === carrier);

  const autoUrl = selectedCarrier?.trackingBase && trackingNumber
    ? `${selectedCarrier.trackingBase}${trackingNumber}`
    : '';

  const handleSubmit = async () => {
    if (!order || !user) return;
    if (!trackingNumber.trim()) {
      toast.error('Ange ett spårningsnummer');
      return;
    }

    setIsSaving(true);
    try {
      const finalUrl = trackingUrl.trim() || autoUrl || null;
      const existingHistory = Array.isArray(order.status_history) ? order.status_history : [];
      const newHistory = [
        ...existingHistory,
        {
          status: 'shipped',
          timestamp: new Date().toISOString(),
          note: `Skickad via ${selectedCarrier?.label || carrier}. Spårning: ${trackingNumber.trim()}`,
        },
      ];

      const { error } = await supabase.from('orders').update({
        fulfillment_status: 'shipped',
        status: 'shipped',
        shipped_at: new Date().toISOString(),
        shipped_by: user.id,
        tracking_number: trackingNumber.trim(),
        shipping_method: carrier,
        status_history: newHistory,
      }).eq('id', order.id);

      if (error) throw error;

      await logActivity({
        log_type: 'success',
        category: 'fulfillment',
        message: `Order skickad via ${selectedCarrier?.label || carrier}`,
        details: { tracking_number: trackingNumber.trim(), carrier, tracking_url: finalUrl },
        order_id: order.id,
      });

      // Send shipping notification email
      let emailSent = false;
      try {
        const { error: emailError } = await supabase.functions.invoke('send-order-email', {
          body: { order_id: order.id, email_type: 'status_update' },
        });
        emailSent = !emailError;
      } catch {}

      onShipped(order.id, {
        carrier,
        tracking_number: trackingNumber.trim(),
        tracking_url: finalUrl,
      });

      toast.success(emailSent ? 'Order skickad ✓ Mail skickat till kund' : 'Order skickad ✓ (mail kunde inte skickas)');
      onOpenChange(false);
      setTrackingNumber('');
      setTrackingUrl('');
      setCarrier('postnord');
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
            Lägg till frakt
          </DialogTitle>
        </DialogHeader>

        {order && (
          <p className="text-sm text-muted-foreground">
            Order: <span className="font-mono font-medium">{getOrderDisplayId(order)}</span> — {order.order_email}
          </p>
        )}

        <div className="space-y-4">
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Avbryt
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving || !trackingNumber.trim()}>
            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Truck className="w-4 h-4 mr-2" />}
            Markera som skickad
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ShippingFormDialog;
