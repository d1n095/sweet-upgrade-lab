import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Share2, DollarSign, TrendingUp, Copy, Users, CreditCard, Clock, Wallet, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/context/LanguageContext';
import { toast } from 'sonner';

interface AffiliateData {
  id: string;
  name: string;
  code: string;
  commission_percent: number;
  total_earnings: number;
  pending_earnings: number;
  paid_earnings: number;
  total_orders: number;
  total_sales: number;
  is_active: boolean;
  payout_method: string;
  min_payout_amount: number;
  auto_payout: boolean;
}

interface PayoutRequest {
  id: string;
  amount: number;
  payout_type: string;
  status: string;
  created_at: string;
  processed_at: string | null;
}

const AffiliateDashboard = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [affiliateData, setAffiliateData] = useState<AffiliateData | null>(null);
  const [payoutRequests, setPayoutRequests] = useState<PayoutRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [payoutType, setPayoutType] = useState<'cash' | 'store_credit'>('cash');

  const content = {
    sv: {
      title: 'Affiliate Dashboard',
      yourCode: 'Din affiliate-kod',
      copyCode: 'Kopiera kod',
      copied: 'Kopierad!',
      totalEarnings: 'Totalt intjänat',
      pendingEarnings: 'Tillgängligt saldo',
      paidEarnings: 'Utbetalt',
      totalSales: 'Total försäljning',
      totalOrders: 'Antal ordrar',
      commission: 'Din provision',
      customerDiscount: 'Dina kunder får 10% rabatt',
      shareCode: 'Dela din kod och tjäna pengar!',
      inactive: 'Ditt konto är pausat',
      howItWorks: 'Så fungerar det',
      step1: 'Dela din unika kod med dina följare',
      step2: 'De får 10% rabatt på sitt köp',
      step3: 'Du får provision på varje order',
      withdraw: 'Ta ut pengar',
      withdrawTitle: 'Begär utbetalning',
      withdrawDesc: 'Välj belopp och utbetalningsmetod',
      amount: 'Belopp',
      payoutMethod: 'Utbetalningsmetod',
      cash: 'Kontant (Swish/Bank)',
      storeCredit: 'Butikskredit',
      storeCreditBonus: '+10% bonus som butikskredit',
      submit: 'Skicka begäran',
      success: 'Utbetalningsbegäran skickad!',
      payoutHistory: 'Utbetalningshistorik',
      pending: 'Väntar',
      approved: 'Godkänd',
      paid: 'Utbetald',
      rejected: 'Nekad',
      noHistory: 'Ingen utbetalningshistorik ännu',
      insufficientBalance: 'Otillräckligt saldo',
      enterAmount: 'Ange belopp',
    },
    en: {
      title: 'Affiliate Dashboard',
      yourCode: 'Your affiliate code',
      copyCode: 'Copy code',
      copied: 'Copied!',
      totalEarnings: 'Total earnings',
      pendingEarnings: 'Available balance',
      paidEarnings: 'Paid out',
      totalSales: 'Total sales',
      totalOrders: 'Total orders',
      commission: 'Your commission',
      customerDiscount: 'Your customers get 10% off',
      shareCode: 'Share your code and earn money!',
      inactive: 'Your account is paused',
      howItWorks: 'How it works',
      step1: 'Share your unique code with followers',
      step2: 'They get 10% off their purchase',
      step3: 'You earn commission on every order',
      withdraw: 'Withdraw',
      withdrawTitle: 'Request payout',
      withdrawDesc: 'Choose amount and payout method',
      amount: 'Amount',
      payoutMethod: 'Payout method',
      cash: 'Cash (Bank transfer)',
      storeCredit: 'Store credit',
      storeCreditBonus: '+10% bonus as store credit',
      submit: 'Submit request',
      success: 'Payout request submitted!',
      payoutHistory: 'Payout history',
      pending: 'Pending',
      approved: 'Approved',
      paid: 'Paid',
      rejected: 'Rejected',
      noHistory: 'No payout history yet',
      insufficientBalance: 'Insufficient balance',
      enterAmount: 'Enter amount',
    }
  };

  const t = content[language as keyof typeof content] || content.en;

  useEffect(() => {
    if (user?.email) {
      loadAffiliateData();
    }
  }, [user]);

  const loadAffiliateData = async () => {
    if (!user?.email) return;
    
    try {
      const { data: affiliate, error } = await supabase
        .from('affiliates')
        .select('*')
        .eq('email', user.email.toLowerCase())
        .single();

      if (error || !affiliate) {
        setAffiliateData(null);
        return;
      }

      setAffiliateData(affiliate as unknown as AffiliateData);

      // Load payout requests
      const { data: requests } = await supabase
        .from('affiliate_payout_requests')
        .select('*')
        .eq('affiliate_id', affiliate.id)
        .order('created_at', { ascending: false });

      setPayoutRequests((requests || []) as unknown as PayoutRequest[]);
    } catch (error) {
      console.error('Failed to load affiliate data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const copyCode = () => {
    if (affiliateData?.code) {
      navigator.clipboard.writeText(affiliateData.code);
      toast.success(t.copied);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleWithdraw = async () => {
    if (!affiliateData) return;
    
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error(t.enterAmount);
      return;
    }
    
    if (amount > affiliateData.pending_earnings) {
      toast.error(t.insufficientBalance);
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('affiliate_payout_requests')
        .insert({
          affiliate_id: affiliateData.id,
          amount: amount,
          payout_type: payoutType,
        });

      if (error) throw error;

      // Update local pending earnings
      setAffiliateData(prev => prev ? {
        ...prev,
        pending_earnings: prev.pending_earnings - amount
      } : null);

      toast.success(t.success);
      setWithdrawDialogOpen(false);
      setWithdrawAmount('');
      loadAffiliateData();
    } catch (error) {
      console.error('Failed to submit payout request:', error);
      toast.error('Error submitting request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; color: string }> = {
      pending: { label: t.pending, color: 'bg-amber-500/10 text-amber-600' },
      approved: { label: t.approved, color: 'bg-blue-500/10 text-blue-600' },
      paid: { label: t.paid, color: 'bg-green-500/10 text-green-600' },
      rejected: { label: t.rejected, color: 'bg-red-500/10 text-red-600' },
    };
    return statusMap[status] || statusMap.pending;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(language === 'sv' ? 'sv-SE' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-32 bg-secondary/50 rounded-xl" />
        <div className="h-24 bg-secondary/50 rounded-xl" />
      </div>
    );
  }

  if (!affiliateData) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
          <Share2 className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="font-display text-xl font-bold">{t.title}</h2>
          <p className="text-sm text-muted-foreground">
            {language === 'sv' ? `Hej ${affiliateData.name}!` : `Hello ${affiliateData.name}!`}
          </p>
        </div>
      </div>

      {/* Status warning */}
      {!affiliateData.is_active && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-700 text-sm">
          ⏸️ {t.inactive}
        </div>
      )}

      {/* Code card */}
      <div className="p-4 bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-xl border border-amber-500/20">
        <p className="text-sm text-muted-foreground mb-2">{t.yourCode}</p>
        <div className="flex items-center justify-between">
          <p className="font-mono text-2xl font-bold text-amber-600">{affiliateData.code}</p>
          <Button onClick={copyCode} size="sm" variant="secondary" className="gap-2">
            <Copy className="w-4 h-4" />
            {t.copyCode}
          </Button>
        </div>
        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <DollarSign className="w-3 h-3" />
            {affiliateData.commission_percent}% {t.commission.toLowerCase()}
          </span>
          <span>•</span>
          <span>{t.customerDiscount}</span>
        </div>
      </div>

      {/* Balance card with withdraw button */}
      <div className="p-4 bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-xl border border-green-500/20">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{t.pendingEarnings}</p>
            <p className="text-3xl font-bold text-green-600">{formatCurrency(affiliateData.pending_earnings)}</p>
          </div>
          <Dialog open={withdrawDialogOpen} onOpenChange={setWithdrawDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-green-600 hover:bg-green-700">
                <Wallet className="w-4 h-4" />
                {t.withdraw}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t.withdrawTitle}</DialogTitle>
                <DialogDescription>{t.withdrawDesc}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">{t.amount}</label>
                  <div className="relative">
                    <Input
                      type="number"
                      placeholder="0"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      min="1"
                      max={affiliateData.pending_earnings}
                      className="pr-12"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                      SEK
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {language === 'sv' ? 'Max:' : 'Max:'} {formatCurrency(affiliateData.pending_earnings)}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">{t.payoutMethod}</label>
                  <Select value={payoutType} onValueChange={(v) => setPayoutType(v as 'cash' | 'store_credit')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-4 h-4" />
                          {t.cash}
                        </div>
                      </SelectItem>
                      <SelectItem value="store_credit">
                        <div className="flex items-center gap-2">
                          <Wallet className="w-4 h-4" />
                          {t.storeCredit}
                          <span className="text-xs text-green-600 font-medium">{t.storeCreditBonus}</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button 
                  onClick={handleWithdraw} 
                  className="w-full gap-2" 
                  disabled={isSubmitting || !withdrawAmount}
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <ArrowRight className="w-4 h-4" />
                      {t.submit}
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 bg-card border border-border rounded-xl">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs">{t.totalEarnings}</span>
          </div>
          <p className="text-2xl font-bold text-primary">{formatCurrency(affiliateData.total_earnings)}</p>
        </div>
        <div className="p-4 bg-card border border-border rounded-xl">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Users className="w-4 h-4" />
            <span className="text-xs">{t.totalOrders}</span>
          </div>
          <p className="text-2xl font-bold">{affiliateData.total_orders}</p>
        </div>
        <div className="p-4 bg-card border border-border rounded-xl">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Clock className="w-4 h-4" />
            <span className="text-xs">{t.totalSales}</span>
          </div>
          <p className="text-xl font-bold">{formatCurrency(affiliateData.total_sales)}</p>
        </div>
        <div className="p-4 bg-card border border-border rounded-xl">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <CreditCard className="w-4 h-4" />
            <span className="text-xs">{t.paidEarnings}</span>
          </div>
          <p className="text-xl font-bold text-primary">{formatCurrency(affiliateData.paid_earnings)}</p>
        </div>
      </div>

      {/* Payout History */}
      {payoutRequests.length > 0 && (
        <div className="p-4 bg-card border border-border rounded-xl">
          <h3 className="font-semibold mb-3">{t.payoutHistory}</h3>
          <div className="space-y-2">
            {payoutRequests.map((request) => {
              const statusInfo = getStatusBadge(request.status);
              return (
                <div key={request.id} className="flex items-center justify-between p-2 bg-secondary/30 rounded-lg">
                  <div>
                    <p className="font-medium">{formatCurrency(request.amount)}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(request.created_at)} • {request.payout_type === 'store_credit' ? t.storeCredit : t.cash}
                    </p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                    {statusInfo.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* How it works */}
      <div className="p-4 bg-card border border-border rounded-xl">
        <h3 className="font-semibold mb-3">{t.howItWorks}</h3>
        <div className="space-y-2">
          {[t.step1, t.step2, t.step3].map((step, index) => (
            <div key={index} className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-amber-500/10 flex items-center justify-center text-xs font-medium text-amber-600">
                {index + 1}
              </div>
              <p className="text-sm">{step}</p>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

export default AffiliateDashboard;