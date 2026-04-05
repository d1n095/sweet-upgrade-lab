import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, Gift, Share2, Copy, Check, Link as LinkIcon, Loader2,
  MousePointerClick, ShoppingCart, CreditCard, CheckCircle, TrendingUp,
  Zap, Target, ArrowDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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

interface FunnelData {
  clicks: number;
  cartAdds: number;
  checkoutStarts: number;
  purchases: number;
}

const LEVELS = [
  { min: 0, label: 'Starter', icon: '🌱' },
  { min: 5, label: 'Sharer', icon: '🔗' },
  { min: 15, label: 'Influencer', icon: '⭐' },
  { min: 30, label: 'Ambassador', icon: '🏆' },
  { min: 50, label: 'VIP', icon: '💎' },
];

const ReferralDashboard = () => {
  const { user, profile } = useAuth();
  const { language } = useLanguage();
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [funnel, setFunnel] = useState<FunnelData>({ clicks: 0, cartAdds: 0, checkoutStarts: 0, purchases: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [recentEvent, setRecentEvent] = useState<string | null>(null);

  const sv = language === 'sv';
  const referralCode = (profile as any)?.referral_code;
  const referralLink = referralCode ? `${window.location.origin}/r/${referralCode}` : '';

  const loadData = useCallback(async () => {
    if (!user || !referralCode) return;
    try {
      // Load referrals
      const { data: refs } = await supabase
        .from('referrals')
        .select('id, referred_email, status, reward_granted, created_at, converted_at')
        .eq('referrer_id', user.id)
        .order('created_at', { ascending: false });
      setReferrals(refs || []);

      // Load funnel from analytics_events matching this referral_code
      const { data: events } = await supabase
        .from('analytics_events')
        .select('event_type')
        .filter('event_data->>referral_code', 'eq', referralCode);

      if (events) {
        setFunnel({
          clicks: events.filter(e => e.event_type === 'referral_click').length,
          cartAdds: events.filter(e => e.event_type === 'add_to_cart').length,
          checkoutStarts: events.filter(e => e.event_type === 'checkout_start').length,
          purchases: events.filter(e => e.event_type === 'checkout_complete').length,
        });
      }
    } catch (err) {

    } finally {
      setIsLoading(false);
    }
  }, [user, referralCode]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Realtime: listen for new events with this referral code
  useEffect(() => {
    if (!referralCode) return;

    const channel = supabase
      .channel(`referral-${referralCode}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'analytics_events' },
        (payload) => {
          const data = payload.new as any;
          const eventRefCode = data?.event_data?.referral_code;
          if (eventRefCode === referralCode) {
            // Update funnel counts
            setFunnel(prev => {
              const type = data.event_type;
              return {
                clicks: prev.clicks + (type === 'referral_click' ? 1 : 0),
                cartAdds: prev.cartAdds + (type === 'add_to_cart' ? 1 : 0),
                checkoutStarts: prev.checkoutStarts + (type === 'checkout_start' ? 1 : 0),
                purchases: prev.purchases + (type === 'checkout_complete' ? 1 : 0),
              };
            });

            // Show realtime notification
            const labels: Record<string, string> = sv
              ? { referral_click: '🔗 Någon klickade på din länk!', add_to_cart: '🛒 Någon la i kundvagnen!', checkout_start: '💳 Någon startade checkout!', checkout_complete: '🎉 Du fick en order!' }
              : { referral_click: '🔗 Someone clicked your link!', add_to_cart: '🛒 Someone added to cart!', checkout_start: '💳 Someone started checkout!', checkout_complete: '🎉 You got an order!' };

            const msg = labels[data.event_type];
            if (msg) {
              setRecentEvent(msg);
              toast.success(msg);
              setTimeout(() => setRecentEvent(null), 5000);
            }
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [referralCode, sv]);

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success(sv ? 'Kopierad!' : 'Copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const shareLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: sv ? 'Handla hos 4thepeople' : 'Shop at 4thepeople',
          text: sv ? 'Kolla in 4thepeople — hållbara produkter!' : 'Check out 4thepeople — sustainable products!',
          url: referralLink,
        });
      } catch {}
    } else {
      copyLink();
    }
  };

  // Level calculation
  const convertedCount = referrals.filter(r => r.status === 'converted').length;
  const rewardedCount = referrals.filter(r => r.reward_granted).length;
  const totalActions = funnel.clicks + convertedCount;
  
  const currentLevel = [...LEVELS].reverse().find(l => totalActions >= l.min) || LEVELS[0];
  const nextLevel = LEVELS[LEVELS.indexOf(currentLevel) + 1];
  const progressToNext = nextLevel 
    ? Math.min(100, ((totalActions - currentLevel.min) / (nextLevel.min - currentLevel.min)) * 100) 
    : 100;

  if (!user) return null;

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const funnelSteps = [
    { icon: MousePointerClick, label: sv ? 'Klick' : 'Clicks', value: funnel.clicks, color: 'text-blue-500' },
    { icon: ShoppingCart, label: sv ? 'Kundvagn' : 'Cart', value: funnel.cartAdds, color: 'text-orange-500' },
    { icon: CreditCard, label: sv ? 'Checkout' : 'Checkout', value: funnel.checkoutStarts, color: 'text-purple-500' },
    { icon: CheckCircle, label: sv ? 'Köp' : 'Purchases', value: funnel.purchases, color: 'text-accent' },
  ];

  return (
    <div className="space-y-5">
      {/* Realtime notification */}
      {recentEvent && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="bg-accent/10 border border-accent/20 rounded-xl px-4 py-3 text-sm font-medium text-accent flex items-center gap-2"
        >
          <Zap className="w-4 h-4 animate-pulse" />
          {recentEvent}
        </motion.div>
      )}

      {/* Level & Progress */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{currentLevel.icon}</span>
            <div>
              <p className="font-semibold text-sm">{currentLevel.label}</p>
              <p className="text-[11px] text-muted-foreground">
                {nextLevel 
                  ? (sv ? `${nextLevel.min - totalActions} till ${nextLevel.label}` : `${nextLevel.min - totalActions} to ${nextLevel.label}`)
                  : (sv ? 'Högsta nivån!' : 'Top level!')
                }
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="text-xs">
            <Target className="w-3 h-3 mr-1" />
            {totalActions} {sv ? 'poäng' : 'pts'}
          </Badge>
        </div>
        <Progress value={progressToNext} className="h-2" />
        <div className="flex justify-between mt-2">
          {LEVELS.map((l, i) => (
            <span key={i} className={`text-[10px] ${totalActions >= l.min ? 'text-foreground' : 'text-muted-foreground/40'}`}>
              {l.icon}
            </span>
          ))}
        </div>
      </motion.div>

      {/* Referral link */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <LinkIcon className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">{sv ? 'Din referral-länk' : 'Your referral link'}</h3>
        </div>
        <div className="flex gap-2">
          <div className="flex-1 bg-secondary rounded-lg px-3 py-2.5 font-mono text-xs truncate">
            {referralLink || '...'}
          </div>
          <Button variant="outline" size="sm" onClick={copyLink} className="shrink-0">
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </Button>
          <Button size="sm" onClick={shareLink} className="shrink-0">
            <Share2 className="w-4 h-4" />
          </Button>
        </div>
      </motion.div>

      {/* Funnel */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">{sv ? 'Konverteringsflöde' : 'Conversion Funnel'}</h3>
        </div>
        <div className="space-y-1">
          {funnelSteps.map((step, i) => {
            const prevValue = i > 0 ? funnelSteps[i - 1].value : step.value;
            const rate = prevValue > 0 ? Math.round((step.value / prevValue) * 100) : 0;
            const barWidth = funnelSteps[0].value > 0 ? Math.max(8, (step.value / funnelSteps[0].value) * 100) : 8;

            return (
              <div key={step.label}>
                {i > 0 && (
                  <div className="flex items-center justify-center py-0.5">
                    <ArrowDown className="w-3 h-3 text-muted-foreground/40" />
                    {prevValue > 0 && (
                      <span className="text-[10px] text-muted-foreground ml-1">{rate}%</span>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <step.icon className={`w-4 h-4 shrink-0 ${step.color}`} />
                  <div className="flex-1 min-w-0">
                    <div 
                      className="h-8 rounded-lg bg-secondary flex items-center px-3 transition-all duration-500"
                      style={{ width: `${barWidth}%` }}
                    >
                      <span className="text-xs font-bold">{step.value}</span>
                    </div>
                  </div>
                  <span className="text-[11px] text-muted-foreground shrink-0 w-16 text-right">{step.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-card border border-border rounded-xl p-4 text-center">
          <Users className="w-5 h-5 text-primary mx-auto mb-1" />
          <p className="text-2xl font-bold">{referrals.length}</p>
          <p className="text-[11px] text-muted-foreground">{sv ? 'Inbjudna' : 'Invited'}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-card border border-border rounded-xl p-4 text-center">
          <Gift className="w-5 h-5 text-accent mx-auto mb-1" />
          <p className="text-2xl font-bold">{convertedCount}</p>
          <p className="text-[11px] text-muted-foreground">{sv ? 'Handlat' : 'Converted'}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="bg-card border border-border rounded-xl p-4 text-center">
          <CheckCircle className="w-5 h-5 text-green-500 mx-auto mb-1" />
          <p className="text-2xl font-bold">{rewardedCount}</p>
          <p className="text-[11px] text-muted-foreground">{sv ? 'Belöningar' : 'Rewards'}</p>
        </motion.div>
      </div>

      {/* How it works */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-secondary/30 rounded-2xl p-5">
        <h3 className="font-semibold text-sm mb-3">{sv ? 'Så fungerar det' : 'How it works'}</h3>
        <div className="grid sm:grid-cols-3 gap-3">
          {(sv 
            ? ['Dela din unika länk med vänner', 'Din vän registrerar sig och handlar', 'Ni båda får en belöning!']
            : ['Share your unique link with friends', 'Your friend signs up and makes a purchase', 'You both get a reward!']
          ).map((step, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-[11px] shrink-0">
                {i + 1}
              </div>
              <p className="text-xs text-foreground/80">{step}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* History */}
      <div>
        <h3 className="font-semibold text-sm mb-3">{sv ? 'Inbjudningshistorik' : 'Referral History'}</h3>
        {referrals.length === 0 ? (
          <div className="text-center py-8 bg-secondary/30 rounded-xl">
            <Share2 className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-muted-foreground text-sm">{sv ? 'Du har inte bjudit in någon ännu. Dela din länk!' : "You haven't invited anyone yet. Share your link!"}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {referrals.map(ref => (
              <div key={ref.id} className="bg-card border border-border rounded-lg p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{ref.referred_email || (sv ? 'Länk delad' : 'Link shared')}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(ref.created_at).toLocaleDateString(sv ? 'sv-SE' : 'en-US')}
                  </p>
                </div>
                <Badge variant={ref.reward_granted ? 'default' : 'secondary'} className="text-xs">
                  {ref.reward_granted ? (sv ? 'Belönad' : 'Rewarded') : ref.status === 'converted' ? (sv ? 'Handlat' : 'Converted') : (sv ? 'Väntande' : 'Pending')}
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
