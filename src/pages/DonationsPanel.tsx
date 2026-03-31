import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Loader2, Heart, Leaf, TrendingUp, Users, ArrowLeft, Wallet
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/context/LanguageContext';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import DonationImpact from '@/components/donations/DonationImpact';
import SEOHead from '@/components/seo/SEOHead';

interface DonationSummary {
  totalDonated: number;
  donationCount: number;
  projectsActive: number;
  projectsTotalRaised: number;
}

const DonationsPanel = () => {
  const { user, loading: authLoading } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<DonationSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      loadSummary();
    }
  }, [user]);

  const loadSummary = async () => {
    if (!user) return;
    try {
      const [donationsRes, projectsRes] = await Promise.all([
        supabase.from('donations').select('amount').eq('user_id', user.id),
        supabase.from('donation_projects').select('current_amount').eq('is_active', true),
      ]);

      const userDonations = donationsRes.data || [];
      const projects = projectsRes.data || [];

      setSummary({
        totalDonated: userDonations.reduce((sum, d) => sum + Number(d.amount), 0),
        donationCount: userDonations.length,
        projectsActive: projects.length,
        projectsTotalRaised: projects.reduce((sum, p) => sum + Number(p.current_amount), 0),
      });
    } catch {
      // ignore
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

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={language === 'sv' ? 'Mina donationer' : 'My Donations'}
        description={language === 'sv' ? 'Följ dina donationer och deras påverkan.' : 'Track your donations and their impact.'}
        noindex={true}
      />
      <Header />
            </Button>
            <div>
              <h1 className="text-2xl font-semibold">
                {language === 'sv' ? 'Donationspanel' : 'Donations Panel'}
              </h1>
              <p className="text-sm text-muted-foreground">
                {language === 'sv' ? 'Se din påverkan och bidrag' : 'View your impact and contributions'}
              </p>
            </div>
          </div>

          {/* Stats overview */}
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 mt-6">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-xl p-4 text-center">
                <Wallet className="w-5 h-5 text-primary mx-auto mb-1" />
                <p className="text-xl font-bold">{formatCurrency(summary.totalDonated)}</p>
                <p className="text-[10px] text-muted-foreground">{language === 'sv' ? 'Ditt bidrag' : 'Your contribution'}</p>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-card border border-border rounded-xl p-4 text-center">
                <Heart className="w-5 h-5 text-destructive mx-auto mb-1" />
                <p className="text-xl font-bold">{summary.donationCount}</p>
                <p className="text-[10px] text-muted-foreground">{language === 'sv' ? 'Donationer' : 'Donations'}</p>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card border border-border rounded-xl p-4 text-center">
                <Leaf className="w-5 h-5 text-primary mx-auto mb-1" />
                <p className="text-xl font-bold">{summary.projectsActive}</p>
                <p className="text-[10px] text-muted-foreground">{language === 'sv' ? 'Aktiva projekt' : 'Active projects'}</p>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-card border border-border rounded-xl p-4 text-center">
                <TrendingUp className="w-5 h-5 text-accent mx-auto mb-1" />
                <p className="text-xl font-bold">{formatCurrency(summary.projectsTotalRaised)}</p>
                <p className="text-[10px] text-muted-foreground">{language === 'sv' ? 'Totalt insamlat' : 'Total raised'}</p>
              </motion.div>
            </div>
          )}

          {/* Full DonationImpact component */}
          <DonationImpact />
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default DonationsPanel;
