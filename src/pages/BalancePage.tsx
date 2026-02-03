import { motion } from 'framer-motion';
import { Wallet, TrendingUp, Heart, DollarSign, Loader2, ArrowRight } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAdminRole } from '@/hooks/useAdminRole';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

interface BalanceData {
  donationTotal: number;
  affiliateTotal: number;
  pendingPayouts: number;
  userAffiliateBalance: number | null;
  recentDonations: Array<{ amount: number; created_at: string; anonymous_id: string | null }>;
  recentPayouts: Array<{ amount: number; status: string; created_at: string }>;
}

const BalancePage = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const { isAdmin } = useAdminRole();
  const [data, setData] = useState<BalanceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const content: Record<string, {
    title: string;
    subtitle: string;
    donationBalance: string;
    affiliateCommissions: string;
    pendingPayouts: string;
    yourBalance: string;
    noBalance: string;
    recentDonations: string;
    recentPayouts: string;
    viewAll: string;
    noActivity: string;
    adminView: string;
    affiliateView: string;
  }> = {
    sv: {
      title: 'Saldo',
      subtitle: 'Översikt över dina finanser',
      donationBalance: 'Donationssaldo',
      affiliateCommissions: 'Affiliate-provisioner',
      pendingPayouts: 'Väntande utbetalningar',
      yourBalance: 'Ditt saldo',
      noBalance: 'Inget saldo',
      recentDonations: 'Senaste donationer',
      recentPayouts: 'Senaste utbetalningar',
      viewAll: 'Visa alla',
      noActivity: 'Ingen aktivitet ännu',
      adminView: 'Admin-översikt',
      affiliateView: 'Affiliate-saldo',
    },
    en: {
      title: 'Balance',
      subtitle: 'Overview of your finances',
      donationBalance: 'Donation Balance',
      affiliateCommissions: 'Affiliate Commissions',
      pendingPayouts: 'Pending Payouts',
      yourBalance: 'Your Balance',
      noBalance: 'No balance',
      recentDonations: 'Recent Donations',
      recentPayouts: 'Recent Payouts',
      viewAll: 'View all',
      noActivity: 'No activity yet',
      adminView: 'Admin Overview',
      affiliateView: 'Affiliate Balance',
    },
    no: {
      title: 'Saldo',
      subtitle: 'Oversikt over din økonomi',
      donationBalance: 'Donasjonssaldo',
      affiliateCommissions: 'Affiliate-provisjoner',
      pendingPayouts: 'Ventende utbetalinger',
      yourBalance: 'Din saldo',
      noBalance: 'Ingen saldo',
      recentDonations: 'Nylige donasjoner',
      recentPayouts: 'Nylige utbetalinger',
      viewAll: 'Vis alle',
      noActivity: 'Ingen aktivitet ennå',
      adminView: 'Admin-oversikt',
      affiliateView: 'Affiliate-saldo',
    },
    da: {
      title: 'Saldo',
      subtitle: 'Oversigt over din økonomi',
      donationBalance: 'Donationssaldo',
      affiliateCommissions: 'Affiliate-provisioner',
      pendingPayouts: 'Afventende udbetalinger',
      yourBalance: 'Din saldo',
      noBalance: 'Ingen saldo',
      recentDonations: 'Seneste donationer',
      recentPayouts: 'Seneste udbetalinger',
      viewAll: 'Vis alle',
      noActivity: 'Ingen aktivitet endnu',
      adminView: 'Admin-oversigt',
      affiliateView: 'Affiliate-saldo',
    },
    de: {
      title: 'Kontostand',
      subtitle: 'Übersicht über Ihre Finanzen',
      donationBalance: 'Spendensaldo',
      affiliateCommissions: 'Affiliate-Provisionen',
      pendingPayouts: 'Ausstehende Auszahlungen',
      yourBalance: 'Ihr Guthaben',
      noBalance: 'Kein Guthaben',
      recentDonations: 'Letzte Spenden',
      recentPayouts: 'Letzte Auszahlungen',
      viewAll: 'Alle anzeigen',
      noActivity: 'Keine Aktivität',
      adminView: 'Admin-Übersicht',
      affiliateView: 'Affiliate-Guthaben',
    },
    fi: {
      title: 'Saldo',
      subtitle: 'Taloudellinen yleiskatsaus',
      donationBalance: 'Lahjoitussaldo',
      affiliateCommissions: 'Kumppaniprovisiot',
      pendingPayouts: 'Odottavat maksut',
      yourBalance: 'Saldosi',
      noBalance: 'Ei saldoa',
      recentDonations: 'Viimeisimmät lahjoitukset',
      recentPayouts: 'Viimeisimmät maksut',
      viewAll: 'Näytä kaikki',
      noActivity: 'Ei aktiviteettia',
      adminView: 'Admin-yleiskatsaus',
      affiliateView: 'Kumppanisaldo',
    },
    nl: {
      title: 'Saldo',
      subtitle: 'Overzicht van uw financiën',
      donationBalance: 'Donatiesaldo',
      affiliateCommissions: 'Affiliate-commissies',
      pendingPayouts: 'Uitstaande uitbetalingen',
      yourBalance: 'Uw saldo',
      noBalance: 'Geen saldo',
      recentDonations: 'Recente donaties',
      recentPayouts: 'Recente uitbetalingen',
      viewAll: 'Bekijk alles',
      noActivity: 'Geen activiteit',
      adminView: 'Admin-overzicht',
      affiliateView: 'Affiliate-saldo',
    },
    fr: {
      title: 'Solde',
      subtitle: 'Aperçu de vos finances',
      donationBalance: 'Solde des dons',
      affiliateCommissions: 'Commissions affiliés',
      pendingPayouts: 'Paiements en attente',
      yourBalance: 'Votre solde',
      noBalance: 'Pas de solde',
      recentDonations: 'Dons récents',
      recentPayouts: 'Paiements récents',
      viewAll: 'Voir tout',
      noActivity: 'Pas d\'activité',
      adminView: 'Vue admin',
      affiliateView: 'Solde affilié',
    },
    es: {
      title: 'Saldo',
      subtitle: 'Resumen de sus finanzas',
      donationBalance: 'Saldo de donaciones',
      affiliateCommissions: 'Comisiones de afiliados',
      pendingPayouts: 'Pagos pendientes',
      yourBalance: 'Su saldo',
      noBalance: 'Sin saldo',
      recentDonations: 'Donaciones recientes',
      recentPayouts: 'Pagos recientes',
      viewAll: 'Ver todo',
      noActivity: 'Sin actividad',
      adminView: 'Vista de admin',
      affiliateView: 'Saldo de afiliado',
    },
    pl: {
      title: 'Saldo',
      subtitle: 'Przegląd finansów',
      donationBalance: 'Saldo darowizn',
      affiliateCommissions: 'Prowizje partnerskie',
      pendingPayouts: 'Oczekujące wypłaty',
      yourBalance: 'Twoje saldo',
      noBalance: 'Brak salda',
      recentDonations: 'Ostatnie darowizny',
      recentPayouts: 'Ostatnie wypłaty',
      viewAll: 'Zobacz wszystko',
      noActivity: 'Brak aktywności',
      adminView: 'Widok admina',
      affiliateView: 'Saldo partnera',
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
      let recentDonations: BalanceData['recentDonations'] = [];
      let recentPayouts: BalanceData['recentPayouts'] = [];

      if (isAdmin) {
        const [donationsRes, affiliatesRes, payoutsRes, recentDonationsRes] = await Promise.all([
          supabase.from('donation_projects').select('current_amount').eq('is_active', true),
          supabase.from('affiliates').select('pending_earnings'),
          supabase.from('affiliate_payout_requests').select('amount').eq('status', 'pending'),
          supabase.from('donations').select('amount, created_at, anonymous_id').order('created_at', { ascending: false }).limit(5),
        ]);

        donationTotal = donationsRes.data?.reduce((sum, d) => sum + Number(d.current_amount || 0), 0) || 0;
        affiliateTotal = affiliatesRes.data?.reduce((sum, a) => sum + Number(a.pending_earnings || 0), 0) || 0;
        pendingPayouts = payoutsRes.data?.reduce((sum, p) => sum + Number(p.amount || 0), 0) || 0;
        recentDonations = recentDonationsRes.data || [];
      }

      // Check if user is an affiliate
      const { data: affiliateData } = await supabase
        .from('affiliates')
        .select('pending_earnings')
        .eq('user_id', user.id)
        .single();

      if (affiliateData) {
        userAffiliateBalance = Number(affiliateData.pending_earnings) || 0;
        
        // Get recent payouts for affiliate
        const { data: payoutData } = await supabase
          .from('affiliate_payout_requests')
          .select('amount, status, created_at')
          .order('created_at', { ascending: false })
          .limit(5);
        
        recentPayouts = payoutData || [];
      }

      setData({
        donationTotal,
        affiliateTotal,
        pendingPayouts,
        userAffiliateBalance,
        recentDonations,
        recentPayouts,
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(language === 'sv' ? 'sv-SE' : 'en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show nothing if not admin and not affiliate
  if (!isAdmin && data?.userAffiliateBalance === null) {
    return (
      <div className="text-center py-12 bg-secondary/30 rounded-2xl">
        <Wallet className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
        <p className="text-lg font-medium mb-2">{t.noBalance}</p>
        <p className="text-muted-foreground mb-6">
          {language === 'sv' 
            ? 'Du har inga aktiva affiliate- eller provisionsbalanser.'
            : 'You have no active affiliate or commission balances.'}
        </p>
        <Link to="/affiliate">
          <Button>
            {language === 'sv' ? 'Bli affiliate' : 'Become an affiliate'}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3"
      >
        <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
          <Wallet className="w-6 h-6 text-green-600" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">{t.title}</h2>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
      </motion.div>

      {/* Admin Balance Cards */}
      {isAdmin && data && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <p className="text-sm font-medium text-muted-foreground mb-3">{t.adminView}</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-pink-500/10 to-rose-500/10 border border-pink-500/20 rounded-xl p-5">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Heart className="w-5 h-5" />
                <span className="text-sm">{t.donationBalance}</span>
              </div>
              <p className="text-3xl font-bold text-pink-600">{formatCurrency(data.donationTotal)}</p>
            </div>

            <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl p-5">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <TrendingUp className="w-5 h-5" />
                <span className="text-sm">{t.affiliateCommissions}</span>
              </div>
              <p className="text-3xl font-bold text-amber-600">{formatCurrency(data.affiliateTotal)}</p>
            </div>

            <div className="bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-500/20 rounded-xl p-5">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <DollarSign className="w-5 h-5" />
                <span className="text-sm">{t.pendingPayouts}</span>
              </div>
              <p className="text-3xl font-bold text-blue-600">{formatCurrency(data.pendingPayouts)}</p>
            </div>
          </div>

          {/* Recent Donations for Admin */}
          {data.recentDonations.length > 0 && (
            <div className="mt-6 bg-card border border-border rounded-xl p-4">
              <h4 className="font-medium mb-3">{t.recentDonations}</h4>
              <div className="space-y-2">
                {data.recentDonations.map((donation, index) => (
                  <div key={index} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <span className="text-sm text-muted-foreground">
                      {donation.anonymous_id || 'Anonymous'}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">{formatDate(donation.created_at)}</span>
                      <span className="font-medium text-green-600">+{formatCurrency(donation.amount)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Affiliate Balance */}
      {data?.userAffiliateBalance !== null && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {!isAdmin && <p className="text-sm font-medium text-muted-foreground mb-3">{t.affiliateView}</p>}
          <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-xl p-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Wallet className="w-5 h-5" />
              <span className="text-sm">{t.yourBalance}</span>
            </div>
            <p className="text-4xl font-bold text-green-600">{formatCurrency(data?.userAffiliateBalance || 0)}</p>
            
            <Link to="/profile?tab=orders" className="mt-4 inline-block">
              <Button variant="outline" size="sm">
                {language === 'sv' ? 'Till affiliate-dashboard' : 'Go to affiliate dashboard'}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>

          {/* Recent Payouts for Affiliate */}
          {data?.recentPayouts && data.recentPayouts.length > 0 && (
            <div className="mt-4 bg-card border border-border rounded-xl p-4">
              <h4 className="font-medium mb-3">{t.recentPayouts}</h4>
              <div className="space-y-2">
                {data.recentPayouts.map((payout, index) => (
                  <div key={index} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      payout.status === 'completed' ? 'bg-green-100 text-green-700' :
                      payout.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {payout.status}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">{formatDate(payout.created_at)}</span>
                      <span className="font-medium">{formatCurrency(payout.amount)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default BalancePage;
