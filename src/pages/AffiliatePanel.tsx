import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Loader2, Share2, DollarSign, TrendingUp, Users, CreditCard,
  ArrowLeft, Wallet, Clock, Copy, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/context/LanguageContext';
import { toast } from 'sonner';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import AffiliateDashboard from '@/components/dashboard/AffiliateDashboard';

const AffiliatePanel = () => {
  const { user, loading: authLoading } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [affiliateData, setAffiliateData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      loadAffiliateData();
    }
  }, [user]);

  const loadAffiliateData = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('affiliates')
        .select('*')
        .eq('user_id', user.id)
        .single();

      setAffiliateData(data);
    } catch {
      // Not an affiliate
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', minimumFractionDigits: 0 }).format(amount);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
        </div>
        <Footer />
      </div>
    );
  }

  if (!affiliateData) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-24 pb-20">
          <div className="container mx-auto px-4 max-w-2xl text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-secondary flex items-center justify-center">
              <Share2 className="w-8 h-8 text-muted-foreground" />
            </div>
            <h1 className="text-2xl font-bold mb-2">
              {language === 'sv' ? 'Inte affiliate' : 'Not an affiliate'}
            </h1>
            <p className="text-muted-foreground mb-6">
              {language === 'sv' ? 'Du är inte registrerad som affiliate ännu.' : "You're not registered as an affiliate yet."}
            </p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => navigate('/profile')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                {language === 'sv' ? 'Tillbaka till profil' : 'Back to profile'}
              </Button>
              <Link to="/affiliate">
                <Button>
                  {language === 'sv' ? 'Bli affiliate' : 'Become an affiliate'}
                </Button>
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-24 pb-20">
        <div className="container mx-auto px-4 max-w-4xl">
          {/* Header */}
          <div className="flex items-center gap-3 mb-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/profile')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-semibold">
                {language === 'sv' ? 'Affiliate-panel' : 'Affiliate Panel'}
              </h1>
              <p className="text-sm text-muted-foreground">
                {language === 'sv' ? 'Hantera din affiliate-verksamhet' : 'Manage your affiliate business'}
              </p>
            </div>
          </div>

          {/* Stats overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 mt-6">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-xl p-4 text-center">
              <Wallet className="w-5 h-5 text-primary mx-auto mb-1" />
              <p className="text-xl font-bold">{formatCurrency(Number(affiliateData.pending_earnings) || 0)}</p>
              <p className="text-[10px] text-muted-foreground">{language === 'sv' ? 'Tillgängligt saldo' : 'Available balance'}</p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-card border border-border rounded-xl p-4 text-center">
              <TrendingUp className="w-5 h-5 text-accent mx-auto mb-1" />
              <p className="text-xl font-bold">{formatCurrency(Number(affiliateData.total_earnings) || 0)}</p>
              <p className="text-[10px] text-muted-foreground">{language === 'sv' ? 'Totalt intjänat' : 'Total earnings'}</p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card border border-border rounded-xl p-4 text-center">
              <DollarSign className="w-5 h-5 text-foreground mx-auto mb-1" />
              <p className="text-xl font-bold">{formatCurrency(Number(affiliateData.paid_earnings) || 0)}</p>
              <p className="text-[10px] text-muted-foreground">{language === 'sv' ? 'Utbetalt' : 'Paid out'}</p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-card border border-border rounded-xl p-4 text-center">
              <Users className="w-5 h-5 text-foreground mx-auto mb-1" />
              <p className="text-xl font-bold">{affiliateData.total_orders || 0}</p>
              <p className="text-[10px] text-muted-foreground">{language === 'sv' ? 'Ordrar' : 'Orders'}</p>
            </motion.div>
          </div>

          {/* Code card */}
          <div className="bg-card border border-border rounded-xl p-5 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">{language === 'sv' ? 'Din affiliate-kod' : 'Your affiliate code'}</p>
                <p className="text-2xl font-mono font-bold tracking-wider">{affiliateData.code}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{affiliateData.commission_percent}% {language === 'sv' ? 'provision' : 'commission'}</Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(affiliateData.code);
                    toast.success(language === 'sv' ? 'Kopierad!' : 'Copied!');
                  }}
                >
                  <Copy className="w-3.5 h-3.5 mr-1" />
                  {language === 'sv' ? 'Kopiera' : 'Copy'}
                </Button>
              </div>
            </div>
          </div>

          {/* Full Affiliate Dashboard component */}
          <AffiliateDashboard />
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default AffiliatePanel;
