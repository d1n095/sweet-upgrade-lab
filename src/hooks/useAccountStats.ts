import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface AccountStats {
  ordersCount: number;
  totalDonated: number;
}

export const useAccountStats = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<AccountStats>({ ordersCount: 0, totalDonated: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      if (!user) {
        setStats({ ordersCount: 0, totalDonated: 0 });
        setIsLoading(false);
        return;
      }

      try {
        // Fetch orders count
        const { count: ordersCount } = await supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);

        // Fetch total donations
        const { data: donations } = await supabase
          .from('donations')
          .select('amount')
          .eq('user_id', user.id);

        const totalDonated = donations?.reduce((sum, d) => sum + Number(d.amount), 0) || 0;

        setStats({
          ordersCount: ordersCount || 0,
          totalDonated,
        });
      } catch (error) {
        console.error('Failed to load account stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadStats();
  }, [user]);

  return { stats, isLoading };
};
