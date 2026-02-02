import { useEffect, useState } from 'react';
import { Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAdminRole } from '@/hooks/useAdminRole';
import { useLanguage } from '@/context/LanguageContext';

const ProfileBalanceBadge = () => {
  const { user } = useAuth();
  const { isAdmin } = useAdminRole();
  const { language } = useLanguage();
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchBalance = async () => {
      try {
        if (isAdmin) {
          // For admin: show total pending affiliate payouts
          const { data: affiliates } = await supabase
            .from('affiliates')
            .select('pending_earnings');

          const totalPending = affiliates?.reduce((sum, a) => sum + Number(a.pending_earnings ?? 0), 0) || 0;
          setBalance(totalPending);
        } else {
          // For affiliates: show their own balance
          const { data: affiliate } = await supabase
            .from('affiliates')
            .select('pending_earnings')
            .eq('user_id', user.id)
            .maybeSingle();

          if (affiliate) {
            setBalance(Number(affiliate.pending_earnings ?? 0));
          }
        }
      } catch (error) {
        console.error('Failed to fetch balance:', error);
      }
    };

    fetchBalance();
  }, [user, isAdmin]);

  if (balance === null || balance === 0) return null;

  return (
    <Badge 
      variant="outline" 
      className="gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800"
    >
      <Wallet className="w-3.5 h-3.5" />
      <span className="font-medium">{balance.toFixed(0)} kr</span>
      <span className="text-xs opacity-75">
        {isAdmin 
          ? (language === 'sv' ? 'väntande' : 'pending')
          : (language === 'sv' ? 'saldo' : 'balance')
        }
      </span>
    </Badge>
  );
};

export default ProfileBalanceBadge;
