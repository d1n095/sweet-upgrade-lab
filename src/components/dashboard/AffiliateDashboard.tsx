import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Share2, DollarSign, TrendingUp, Copy, Users, CreditCard, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
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
}

const AffiliateDashboard = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [affiliateData, setAffiliateData] = useState<AffiliateData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const content = {
    sv: {
      title: 'Affiliate Dashboard',
      yourCode: 'Din affiliate-kod',
      copyCode: 'Kopiera kod',
      copied: 'Kopierad!',
      totalEarnings: 'Totalt intjänat',
      pendingEarnings: 'Väntar på utbetalning',
      paidEarnings: 'Utbetalt',
      totalSales: 'Total försäljning',
      totalOrders: 'Antal ordrar',
      commission: 'Din provision',
      payoutThreshold: 'Utbetalning sker vid 500 kr',
      customerDiscount: 'Dina kunder får 10% rabatt',
      shareCode: 'Dela din kod och tjäna pengar!',
      inactive: 'Ditt konto är pausat',
      howItWorks: 'Så fungerar det',
      step1: 'Dela din unika kod med dina följare',
      step2: 'De får 10% rabatt på sitt köp',
      step3: 'Du får provision på varje order',
    },
    en: {
      title: 'Affiliate Dashboard',
      yourCode: 'Your affiliate code',
      copyCode: 'Copy code',
      copied: 'Copied!',
      totalEarnings: 'Total earnings',
      pendingEarnings: 'Pending payout',
      paidEarnings: 'Paid out',
      totalSales: 'Total sales',
      totalOrders: 'Total orders',
      commission: 'Your commission',
      payoutThreshold: 'Payout at 500 SEK',
      customerDiscount: 'Your customers get 10% off',
      shareCode: 'Share your code and earn money!',
      inactive: 'Your account is paused',
      howItWorks: 'How it works',
      step1: 'Share your unique code with followers',
      step2: 'They get 10% off their purchase',
      step3: 'You earn commission on every order',
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

  const payoutProgress = affiliateData ? Math.min((affiliateData.pending_earnings / 500) * 100, 100) : 0;

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-32 bg-secondary/50 rounded-xl" />
        <div className="h-24 bg-secondary/50 rounded-xl" />
      </div>
    );
  }

  if (!affiliateData) {
    return null; // User is not an affiliate
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

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 bg-card border border-border rounded-xl">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs">{t.totalEarnings}</span>
          </div>
          <p className="text-2xl font-bold text-success">{formatCurrency(affiliateData.total_earnings)}</p>
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
            <span className="text-xs">{t.pendingEarnings}</span>
          </div>
          <p className="text-xl font-bold text-amber-600">{formatCurrency(affiliateData.pending_earnings)}</p>
        </div>
        <div className="p-4 bg-card border border-border rounded-xl">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <CreditCard className="w-4 h-4" />
            <span className="text-xs">{t.paidEarnings}</span>
          </div>
          <p className="text-xl font-bold text-primary">{formatCurrency(affiliateData.paid_earnings)}</p>
        </div>
      </div>

      {/* Payout progress */}
      <div className="p-4 bg-card border border-border rounded-xl">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium">{t.payoutThreshold}</span>
          <span className="text-sm text-muted-foreground">
            {formatCurrency(affiliateData.pending_earnings)} / {formatCurrency(500)}
          </span>
        </div>
        <Progress value={payoutProgress} className="h-3" />
        {payoutProgress >= 100 && (
          <p className="text-xs text-success mt-2">
            ✓ {language === 'sv' ? 'Utbetalning kommer snart!' : 'Payout coming soon!'}
          </p>
        )}
      </div>

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
