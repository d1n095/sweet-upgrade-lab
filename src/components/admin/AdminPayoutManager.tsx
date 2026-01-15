import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Wallet, Check, X, Clock, Loader2, 
  DollarSign, User, CreditCard, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/context/LanguageContext';
import { toast } from 'sonner';

interface PayoutRequest {
  id: string;
  affiliate_id: string;
  amount: number;
  payout_type: string;
  status: string;
  notes: string | null;
  created_at: string;
  processed_at: string | null;
  affiliate?: {
    name: string;
    email: string;
    payout_method: string;
  };
}

const AdminPayoutManager = () => {
  const { language } = useLanguage();
  const [requests, setRequests] = useState<PayoutRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<PayoutRequest | null>(null);
  const [adminNotes, setAdminNotes] = useState('');

  const content = {
    sv: {
      title: 'Utbetalningar',
      subtitle: 'Hantera affiliate-utbetalningar',
      noRequests: 'Inga väntande utbetalningar',
      pending: 'Väntande',
      approved: 'Godkänd',
      paid: 'Utbetald',
      rejected: 'Nekad',
      approve: 'Godkänn',
      reject: 'Neka',
      markPaid: 'Markera betald',
      cash: 'Kontant',
      storeCredit: 'Butikskredit',
      refresh: 'Uppdatera',
      processTitle: 'Hantera utbetalning',
      notes: 'Anteckningar',
      affiliateName: 'Affiliate',
      amount: 'Belopp',
      type: 'Typ',
      method: 'Metod',
      success: 'Uppdaterad!',
    },
    en: {
      title: 'Payouts',
      subtitle: 'Manage affiliate payouts',
      noRequests: 'No pending payouts',
      pending: 'Pending',
      approved: 'Approved',
      paid: 'Paid',
      rejected: 'Rejected',
      approve: 'Approve',
      reject: 'Reject',
      markPaid: 'Mark as paid',
      cash: 'Cash',
      storeCredit: 'Store credit',
      refresh: 'Refresh',
      processTitle: 'Process payout',
      notes: 'Notes',
      affiliateName: 'Affiliate',
      amount: 'Amount',
      type: 'Type',
      method: 'Method',
      success: 'Updated!',
    }
  };

  const t = content[language as keyof typeof content] || content.en;

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      // Load payout requests
      const { data: requestsData, error: requestsError } = await supabase
        .from('affiliate_payout_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (requestsError) throw requestsError;

      // Load affiliates to get names
      const { data: affiliatesData } = await supabase
        .from('affiliates')
        .select('id, name, email, payout_method');

      const affiliatesMap = new Map(
        (affiliatesData || []).map((a: { id: string; name: string; email: string; payout_method: string }) => [a.id, a])
      );

      const requestsWithAffiliates = (requestsData || []).map((r: PayoutRequest) => ({
        ...r,
        affiliate: affiliatesMap.get(r.affiliate_id) || null
      }));

      setRequests(requestsWithAffiliates);
    } catch (error) {
      console.error('Failed to load payout requests:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateRequestStatus = async (id: string, status: string) => {
    setProcessingId(id);
    try {
      const updateData: { status: string; notes?: string; processed_at?: string } = { status };
      
      if (status !== 'pending') {
        updateData.processed_at = new Date().toISOString();
      }
      
      if (adminNotes) {
        updateData.notes = adminNotes;
      }

      const { error } = await supabase
        .from('affiliate_payout_requests')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      toast.success(t.success);
      setSelectedRequest(null);
      setAdminNotes('');
      loadRequests();
    } catch (error) {
      console.error('Failed to update status:', error);
      toast.error('Error updating status');
    } finally {
      setProcessingId(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(language === 'sv' ? 'sv-SE' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; color: string; icon: React.ElementType }> = {
      pending: { label: t.pending, color: 'bg-amber-500/10 text-amber-600', icon: Clock },
      approved: { label: t.approved, color: 'bg-blue-500/10 text-blue-600', icon: Check },
      paid: { label: t.paid, color: 'bg-green-500/10 text-green-600', icon: DollarSign },
      rejected: { label: t.rejected, color: 'bg-red-500/10 text-red-600', icon: X },
    };
    return statusMap[status] || statusMap.pending;
  };

  const pendingCount = requests.filter(r => r.status === 'pending').length;
  const approvedCount = requests.filter(r => r.status === 'approved').length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h3 className="font-semibold">{t.title}</h3>
            <p className="text-sm text-muted-foreground">{t.subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <Badge className="bg-amber-500/10 text-amber-600">
              {pendingCount} {t.pending.toLowerCase()}
            </Badge>
          )}
          {approvedCount > 0 && (
            <Badge className="bg-blue-500/10 text-blue-600">
              {approvedCount} {t.approved.toLowerCase()}
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={loadRequests} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            {t.refresh}
          </Button>
        </div>
      </div>

      {/* Requests list */}
      {requests.length === 0 ? (
        <div className="text-center py-12 bg-secondary/30 rounded-xl">
          <Wallet className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">{t.noRequests}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => {
            const statusInfo = getStatusBadge(request.status);
            const StatusIcon = statusInfo.icon;

            return (
              <motion.div
                key={request.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card border border-border rounded-xl p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center">
                      <User className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{request.affiliate?.name || 'Unknown'}</p>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>
                          <StatusIcon className="w-3 h-3 inline mr-1" />
                          {statusInfo.label}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {request.affiliate?.email} • {formatDate(request.created_at)}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <CreditCard className="w-3 h-3" />
                          {request.payout_type === 'store_credit' ? t.storeCredit : t.cash}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(request.amount)}
                    </p>
                    
                    {request.status === 'pending' && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => updateRequestStatus(request.id, 'approved')}
                          disabled={processingId === request.id}
                          className="gap-1 bg-blue-600 hover:bg-blue-700"
                        >
                          {processingId === request.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Check className="w-4 h-4" />
                              {t.approve}
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedRequest(request);
                          }}
                          disabled={processingId === request.id}
                          className="gap-1 text-red-600 hover:bg-red-50"
                        >
                          <X className="w-4 h-4" />
                          {t.reject}
                        </Button>
                      </div>
                    )}

                    {request.status === 'approved' && (
                      <Button
                        size="sm"
                        onClick={() => updateRequestStatus(request.id, 'paid')}
                        disabled={processingId === request.id}
                        className="gap-1 bg-green-600 hover:bg-green-700"
                      >
                        {processingId === request.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <DollarSign className="w-4 h-4" />
                            {t.markPaid}
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>

                {request.notes && (
                  <div className="mt-3 p-2 bg-secondary/50 rounded-lg text-sm text-muted-foreground">
                    {request.notes}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Reject Dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.processTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="p-4 bg-secondary/50 rounded-lg">
              <p className="text-sm text-muted-foreground">{t.affiliateName}</p>
              <p className="font-medium">{selectedRequest?.affiliate?.name}</p>
              <p className="text-sm text-muted-foreground mt-2">{t.amount}</p>
              <p className="font-bold text-lg">{formatCurrency(selectedRequest?.amount || 0)}</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t.notes}</label>
              <Textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder={language === 'sv' ? 'Anledning till avslag...' : 'Reason for rejection...'}
                rows={3}
              />
            </div>

            <Button
              onClick={() => selectedRequest && updateRequestStatus(selectedRequest.id, 'rejected')}
              className="w-full bg-red-600 hover:bg-red-700"
              disabled={processingId === selectedRequest?.id}
            >
              {processingId === selectedRequest?.id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <X className="w-4 h-4 mr-2" />
                  {t.reject}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPayoutManager;