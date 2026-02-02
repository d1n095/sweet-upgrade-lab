import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Eye, EyeOff, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/context/LanguageContext';
import { useAdminRole } from '@/hooks/useAdminRole';

interface Donation {
  id: string;
  amount: number;
  anonymous_id: string | null;
  is_anonymous: boolean;
  created_at: string;
  user_id: string | null;
  purpose: string;
}

interface DonationWithEmail extends Donation {
  user_email?: string;
}

const LiveDonationFeed = () => {
  const { language } = useLanguage();
  const { isAdmin } = useAdminRole();
  const [donations, setDonations] = useState<DonationWithEmail[]>([]);
  const [showUserInfo, setShowUserInfo] = useState(false);

  const content = {
    sv: {
      title: 'Senaste donationer',
      anonymous: 'Anonym',
      showDonors: 'Visa donatorer',
      hideDonors: 'Dölj donatorer',
      justNow: 'Just nu',
      minutesAgo: 'min sedan',
      hoursAgo: 'tim sedan',
      daysAgo: 'dagar sedan',
      donated: 'donerade',
    },
    en: {
      title: 'Recent donations',
      anonymous: 'Anonymous',
      showDonors: 'Show donors',
      hideDonors: 'Hide donors',
      justNow: 'Just now',
      minutesAgo: 'min ago',
      hoursAgo: 'hours ago',
      daysAgo: 'days ago',
      donated: 'donated',
    },
  };

  const t = content[language as keyof typeof content] || content.en;

  useEffect(() => {
    fetchDonations();

    const channel = supabase
      .channel('live-donations')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'donations' },
        (payload) => {
          const newDonation = payload.new as Donation;
          setDonations(prev => [{ ...newDonation }, ...prev.slice(0, 9)]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchDonations = async () => {
    try {
      const { data, error } = await supabase
        .from('donations')
        .select('id, amount, anonymous_id, is_anonymous, created_at, user_id, purpose')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setDonations(data || []);
    } catch (error) {
      console.error('Failed to fetch donations:', error);
    }
  };

  const getTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t.justNow;
    if (diffMins < 60) return `${diffMins} ${t.minutesAgo}`;
    if (diffHours < 24) return `${diffHours} ${t.hoursAgo}`;
    return `${diffDays} ${t.daysAgo}`;
  };

  if (donations.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Heart className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">{t.title}</h3>
        </div>
        {isAdmin && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowUserInfo(!showUserInfo)}
            className="gap-2"
          >
            {showUserInfo ? (
              <>
                <EyeOff className="w-4 h-4" />
                {t.hideDonors}
              </>
            ) : (
              <>
                <Eye className="w-4 h-4" />
                {t.showDonors}
              </>
            )}
          </Button>
        )}
      </div>

      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {donations.map((donation) => (
            <motion.div
              key={donation.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50"
            >
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-muted-foreground">
                    {donation.anonymous_id || 'DON-XXXXX'}
                  </span>
                  {isAdmin && showUserInfo && donation.user_id && (
                    <Badge variant="outline" className="text-xs">
                      ID: {donation.user_id.slice(0, 8)}...
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {getTimeAgo(donation.created_at)}
                </p>
              </div>
              <div className="text-right">
                <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  +{donation.amount} kr
                </Badge>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default LiveDonationFeed;
