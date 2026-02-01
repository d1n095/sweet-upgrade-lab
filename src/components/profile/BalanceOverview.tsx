import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Wallet, TrendingUp, Heart, DollarSign, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAdminRole } from '@/hooks/useAdminRole';
import { useLanguage } from '@/context/LanguageContext';

interface BalanceData {
  donationTotal: number;
  affiliateTotal: number;
  pendingPayouts: number;
  userAffiliateBalance: number | null;
}

const BalanceOverview = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const { isAdmin } = useAdminRole();
  const [data, setData] = useState<BalanceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const content: Record<string, {
    title: string;
    donationBalance: string;
    affiliateCommissions: string;
    pendingPayouts: string;
    yourBalance: string;
    noBalance: string;
  }> = {
    sv: {
      title: 'Ekonomisk översikt',
      donationBalance: 'Donationssaldo',
      affiliateCommissions: 'Affiliate-provisioner',
      pendingPayouts: 'Väntande utbetalningar',
      yourBalance: 'Ditt saldo',
      noBalance: 'Inget saldo',
    },
    en: {
      title: 'Financial Overview',
      donationBalance: 'Donation Balance',
      affiliateCommissions: 'Affiliate Commissions',
      pendingPayouts: 'Pending Payouts',
      yourBalance: 'Your Balance',
      noBalance: 'No balance',
    },
    no: {
      title: 'Økonomisk oversikt',
      donationBalance: 'Donasjonssaldo',
      affiliateCommissions: 'Affiliate-provisjoner',
      pendingPayouts: 'Ventende utbetalinger',
      yourBalance: 'Din saldo',
      noBalance: 'Ingen saldo',
    },
    da: {
      title: 'Økonomisk oversigt',
      donationBalance: 'Donationssaldo',
      affiliateCommissions: 'Affiliate-provisioner',
      pendingPayouts: 'Afventende udbetalinger',
      yourBalance: 'Din saldo',
      noBalance: 'Ingen saldo',
    },
    de: {
      title: 'Finanzübersicht',
      donationBalance: 'Spendensaldo',
      affiliateCommissions: 'Affiliate-Provisionen',
      pendingPayouts: 'Ausstehende Auszahlungen',
      yourBalance: 'Ihr Guthaben',
      noBalance: 'Kein Guthaben',
    },
    fi: {
      title: 'Taloudellinen yleiskatsaus',
      donationBalance: 'Lahjoitussaldo',
      affiliateCommissions: 'Kumppaniprovisiot',
      pendingPayouts: 'Odottavat maksut',
      yourBalance: 'Saldosi',
      noBalance: 'Ei saldoa',
    },
    nl: {
      title: 'Financieel overzicht',
      donationBalance: 'Donatiesaldo',
      affiliateCommissions: 'Affiliate-commissies',
      pendingPayouts: 'Uitstaande uitbetalingen',
      yourBalance: 'Jouw saldo',
      noBalance: 'Geen saldo',
    },
    fr: {
      title: 'Aperçu financier',
      donationBalance: 'Solde des dons',
      affiliateCommissions: 'Commissions affiliés',
      pendingPayouts: 'Paiements en attente',
      yourBalance: 'Votre solde',
      noBalance: 'Pas de solde',
    },
    es: {
      title: 'Resumen financiero',
      donationBalance: 'Saldo de donaciones',
      affiliateCommissions: 'Comisiones de afiliados',
      pendingPayouts: 'Pagos pendientes',
      yourBalance: 'Tu saldo',
      noBalance: 'Sin saldo',
    },
    pl: {
      title: 'Przegląd finansowy',
      donationBalance: 'Saldo darowizn',
      affiliateCommissions: 'Prowizje partnerskie',
      pendingPayouts: 'Oczekujące wypłaty',
      yourBalance: 'Twoje saldo',
      noBalance: 'Brak salda',
    },
  };

  const t = content[language] || content.en;

  useEffect(() => {
    if (user) {
      loadBalanceData();
    }
  }, [user, isAdmin]);

  const loadBalanceData = async () => {
    if (!user) return;

    try {
      let donationTotal = 0;
      let affiliateTotal = 0;
      let pendingPayouts = 0;
      let userAffiliateBalance: number | null = null;

      if (isAdmin) {
        // Load admin data
        const [donationsRes, affiliatesRes, payoutsRes] = await Promise.all([
          supabase
            .from('donation_projects')
            .select('current_amount')
            .eq('is_active', true),
          supabase
            .from('affiliates')
            .select('pending_earnings'),
          supabase
            .from('affiliate_payout_requests')
            .select('amount')
            .eq('status', 'pending'),
        ]);

        donationTotal = donationsRes.data?.reduce((sum, d) => sum + Number(d.current_amount || 0), 0) || 0;
        affiliateTotal = affiliatesRes.data?.reduce((sum, a) => sum + Number(a.pending_earnings || 0), 0) || 0;
        pendingPayouts = payoutsRes.data?.reduce((sum, p) => sum + Number(p.amount || 0), 0) || 0;
      }

      // Check if user is an affiliate
      const { data: affiliateData } = await supabase
        .from('affiliates')
        .select('pending_earnings')
        .eq('user_id', user.id)
        .single();

      if (affiliateData) {
        userAffiliateBalance = Number(affiliateData.pending_earnings) || 0;
      }

      setData({
        donationTotal,
        affiliateTotal,
        pendingPayouts,
        userAffiliateBalance,
      });
    } catch (error) {
      console.error('Failed to load balance data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Don't show if not admin and not affiliate
  if (!isAdmin && data?.userAffiliateBalance === null) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
          <Wallet className="w-5 h-5 text-green-600" />
        </div>
        <h3 className="font-semibold text-lg">{t.title}</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Admin: Donation Balance */}
        {isAdmin && (
          <div className="bg-gradient-to-br from-pink-500/10 to-rose-500/10 border border-pink-500/20 rounded-xl p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Heart className="w-4 h-4" />
              <span className="text-sm">{t.donationBalance}</span>
            </div>
            <p className="text-2xl font-bold text-pink-600">{formatCurrency(data.donationTotal)}</p>
          </div>
        )}

        {/* Admin: Affiliate Commissions */}
        {isAdmin && (
          <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm">{t.affiliateCommissions}</span>
            </div>
            <p className="text-2xl font-bold text-amber-600">{formatCurrency(data.affiliateTotal)}</p>
          </div>
        )}

        {/* Admin: Pending Payouts */}
        {isAdmin && (
          <div className="bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-500/20 rounded-xl p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <DollarSign className="w-4 h-4" />
              <span className="text-sm">{t.pendingPayouts}</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">{formatCurrency(data.pendingPayouts)}</p>
          </div>
        )}

        {/* User Affiliate Balance (if affiliate) */}
        {!isAdmin && data.userAffiliateBalance !== null && (
          <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-xl p-4 md:col-span-3">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Wallet className="w-4 h-4" />
              <span className="text-sm">{t.yourBalance}</span>
            </div>
            <p className="text-3xl font-bold text-green-600">{formatCurrency(data.userAffiliateBalance)}</p>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default BalanceOverview;
