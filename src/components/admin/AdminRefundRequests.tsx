import { useState, useEffect } from 'react';
import { RotateCcw, Check, X, Clock, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { tracedInvoke } from '@/lib/tracedInvoke';
import { useAdminRole } from '@/hooks/useAdminRole';
import { toast } from 'sonner';

interface RefundRequest {
  id: string;
  order_id: string;
  requested_by: string;
  reason: string;
  status: string;
  admin_notes: string | null;
  stripe_refund_id: string | null;
  refund_amount: number | null;
  created_at: string;
  processed_at: string | null;
}

const AdminRefundRequests = () => {
  const { isAdmin } = useAdminRole();
  const [requests, setRequests] = useState<RefundRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});
  const [showRejectInput, setShowRejectInput] = useState<string | null>(null);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    const { data } = await supabase
      .from('refund_requests')
      .select('*')
      .order('created_at', { ascending: false });
    setRequests((data || []) as unknown as RefundRequest[]);
    setLoading(false);
  };

  const handleApprove = async (id: string) => {
    if (!confirm('Godkänn återbetalning? Stripe debiteras.')) return;
    setProcessingId(id);
    try {
      const { data, error } = await supabase.functions.invoke('process-refund', {
        body: { action: 'approve', refund_request_id: id },
      });
      if (error) throw error;
      toast.success(`Återbetalning godkänd${data?.stripe_refund_id ? ` (Stripe: ${data.stripe_refund_id})` : ''}`);
      loadRequests();
    } catch (e: any) {
      toast.error(e?.message || 'Fel vid godkännande');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    setProcessingId(id);
    try {
      const { error } = await supabase.functions.invoke('process-refund', {
        body: { action: 'reject', refund_request_id: id, admin_notes: rejectNotes[id] || '' },
      });
      if (error) throw error;
      toast.success('Förfrågan avvisad');
      setShowRejectInput(null);
      loadRequests();
    } catch (e: any) {
      toast.error(e?.message || 'Fel vid avvisning');
    } finally {
      setProcessingId(null);
    }
  };

  const fmt = (n: number) => new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', minimumFractionDigits: 0 }).format(n);
  const fmtDate = (d: string) => new Date(d).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' });

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; className: string; icon: React.ElementType }> = {
      pending: { label: 'Väntar', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: Clock },
      approved: { label: 'Godkänd', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: Check },
      rejected: { label: 'Avvisad', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: X },
    };
    const s = map[status] || map.pending;
    const Icon = s.icon;
    return <Badge className={`gap-1 ${s.className}`}><Icon className="w-3 h-3" />{s.label}</Badge>;
  };

  const pending = requests.filter(r => r.status === 'pending');
  const processed = requests.filter(r => r.status !== 'pending');

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      {pending.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Väntande förfrågningar ({pending.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pending.map(req => (
              <div key={req.id} className="p-3 rounded-lg border bg-card space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Order: {req.order_id.slice(0, 8)}…</p>
                    <p className="text-xs text-muted-foreground">{fmtDate(req.created_at)}</p>
                  </div>
                  <div className="text-right">
                    {statusBadge(req.status)}
                    {req.refund_amount && <p className="text-sm font-bold mt-1">{fmt(req.refund_amount)}</p>}
                  </div>
                </div>
                <p className="text-sm bg-muted/50 p-2 rounded"><strong>Anledning:</strong> {req.reason}</p>

                {isAdmin && (
                  <div className="flex items-center gap-2 pt-1">
                    {showRejectInput === req.id ? (
                      <div className="flex-1 space-y-2">
                        <Textarea
                          placeholder="Anledning till avvisning..."
                          value={rejectNotes[req.id] || ''}
                          onChange={(e) => setRejectNotes(prev => ({ ...prev, [req.id]: e.target.value }))}
                          className="text-sm"
                          rows={2}
                        />
                        <div className="flex gap-2">
                          <Button size="sm" variant="destructive" disabled={processingId === req.id} onClick={() => handleReject(req.id)}>
                            {processingId === req.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Avvisa'}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setShowRejectInput(null)}>Avbryt</Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                          disabled={processingId === req.id}
                          onClick={() => handleApprove(req.id)}
                        >
                          {processingId === req.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Check className="w-3.5 h-3.5" /> Godkänn</>}
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowRejectInput(req.id)}>
                          <X className="w-3.5 h-3.5" /> Avvisa
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {pending.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <RotateCcw className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p>Inga väntande återbetalningsförfrågningar</p>
        </div>
      )}

      {processed.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Behandlade ({processed.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {processed.map(req => (
                <div key={req.id} className="flex items-center justify-between p-2.5 rounded-lg border text-sm">
                  <div>
                    <p className="font-medium">Order: {req.order_id.slice(0, 8)}…</p>
                    <p className="text-xs text-muted-foreground">{req.reason}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {req.refund_amount && <span className="font-medium">{fmt(req.refund_amount)}</span>}
                    {statusBadge(req.status)}
                    <span className="text-xs text-muted-foreground">{req.processed_at ? fmtDate(req.processed_at) : ''}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminRefundRequests;
