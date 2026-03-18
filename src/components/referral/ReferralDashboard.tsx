import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Gift, Share2, Copy, Check, Link as LinkIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/context/LanguageContext';
import { toast } from 'sonner';

interface Referral {
  id: string;
  referred_email: string | null;
  status: string;
  reward_granted: boolean;
  created_at: string;
  converted_at: string | null;
}

const ReferralDashboard = () => {
  const { user, profile } = useAuth();
  const { language } = useLanguage();
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const t = language === 'sv' ? {
    title: 'Bjud in vänner',
    subtitle: 'Dela din länk och tjäna belöningar när dina vänner handlar',
    yourLink: 'Din referral-länk',
    copy: 'Kopiera',
    copied: 'Kopierad!',
    share: 'Dela',
    stats: { invited: 'Inbjudna', converted: 'Handlat', rewards: 'Belöningar' },
    history: 'Inbjudningshistorik',
    noReferrals: 'Du har inte bjudit in någon ännu. Dela din länk!',
    status: { pending: 'Väntande', converted: 'Handlat', rewarded: 'Belönad' },
    howItWorks: 'Så fungerar det',
    steps: [
      'Dela din unika länk med vänner',
      'Din vän registrerar sig och handlar',
      'Ni båda får en belöning!'
    ]
  } : {
    title: 'Invite Friends',
    subtitle: 'Share your link and earn rewards when your friends shop',
    yourLink: 'Your referral link',
    copy: 'Copy',
    copied: 'Copied!',
    share: 'Share',
    stats: { invited: 'Invited', converted: 'Converted', rewards: 'Rewards' },
    history: 'Referral History',
    noReferrals: "You haven't invited anyone yet. Share your link!",
    status: { pending: 'Pending', converted: 'Converted', rewarded: 'Rewarded' },
    howItWorks: 'How it works',
    steps: [
      'Share your unique link with friends',
      'Your friend signs up and makes a purchase',
      'You both get a reward!'
    ]
  };

  const referralCode = (profile as any)?.referral_code;
  const referralLink = referralCode ? `${window.location.origin}/r/${referralCode}` : '';

  useEffect(() => {
    if (user) loadReferrals();
  }, [user]);

  const loadReferrals = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('referrals')
        .select('id, referred_email, status, reward_granted, created_at, converted_at')
        .eq('referrer_id', user.id)
        .order('created_at', { ascending: false });
      setReferrals(data || []);
    } catch (err) {
      console.error('Failed to load referrals:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success(t.copied);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: language === 'sv' ? 'Handla hos 4thepeople' : 'Shop at 4thepeople',
          text: language === 'sv' ? 'Kolla in 4thepeople — hållbara produkter!' : 'Check out 4thepeople — sustainable products!',
          url: referralLink,
        });
      } catch {}
    } else {
      copyLink();
    }
  };

  const convertedCount = referrals.filter(r => r.status === 'converted').length;
  const rewardedCount = referrals.filter(r => r.reward_granted).length;

  if (!user) return null;

  return (
    <div className="space-y-6">
      {/* How it works */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-gradient-to-br from-primary/10 to-accent/10 rounded-2xl p-6">
        <h3 className="font-semibold text-lg mb-4">{t.howItWorks}</h3>
        <div className="grid sm:grid-cols-3 gap-4">
          {t.steps.map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                {i + 1}
              </div>
              <p className="text-sm text-foreground/80">{step}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Referral link */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-3">
          <LinkIcon className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">{t.yourLink}</h3>
        </div>
        <div className="flex gap-2">
          <div className="flex-1 bg-secondary rounded-lg px-4 py-2.5 font-mono text-sm truncate">
            {referralLink || '...'}
          </div>
          <Button variant="outline" size="sm" onClick={copyLink} className="shrink-0">
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span className="ml-1.5 hidden sm:inline">{copied ? t.copied : t.copy}</span>
          </Button>
          <Button size="sm" onClick={shareLink} className="shrink-0">
            <Share2 className="w-4 h-4" />
            <span className="ml-1.5 hidden sm:inline">{t.share}</span>
          </Button>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card border border-border rounded-xl p-4 text-center">
          <Users className="w-5 h-5 text-primary mx-auto mb-1" />
          <p className="text-2xl font-bold">{referrals.length}</p>
          <p className="text-xs text-muted-foreground">{t.stats.invited}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-card border border-border rounded-xl p-4 text-center">
          <Gift className="w-5 h-5 text-accent mx-auto mb-1" />
          <p className="text-2xl font-bold">{convertedCount}</p>
          <p className="text-xs text-muted-foreground">{t.stats.converted}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-card border border-border rounded-xl p-4 text-center">
          <Gift className="w-5 h-5 text-green-500 mx-auto mb-1" />
          <p className="text-2xl font-bold">{rewardedCount}</p>
          <p className="text-xs text-muted-foreground">{t.stats.rewards}</p>
        </motion.div>
      </div>

      {/* History */}
      <div>
        <h3 className="font-semibold mb-3">{t.history}</h3>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : referrals.length === 0 ? (
          <div className="text-center py-8 bg-secondary/30 rounded-xl">
            <Share2 className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-muted-foreground text-sm">{t.noReferrals}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {referrals.map(ref => (
              <div key={ref.id} className="bg-card border border-border rounded-lg p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{ref.referred_email || (language === 'sv' ? 'Länk delad' : 'Link shared')}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(ref.created_at).toLocaleDateString(language === 'sv' ? 'sv-SE' : 'en-US')}
                  </p>
                </div>
                <Badge variant={ref.reward_granted ? 'default' : 'secondary'} className="text-xs">
                  {ref.reward_granted ? t.status.rewarded : ref.status === 'converted' ? t.status.converted : t.status.pending}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReferralDashboard;
