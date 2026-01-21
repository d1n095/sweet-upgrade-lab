import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface DonationStats {
  totalDonated: number;
  projectsSupported: number;
  familiesHelped: number;
  treesPlanted: number;
  isLoading: boolean;
}

export const useDonationStats = () => {
  const [stats, setStats] = useState<DonationStats>({
    totalDonated: 0,
    projectsSupported: 0,
    familiesHelped: 0,
    treesPlanted: 0,
    isLoading: true,
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Get total donations
        const { data: donations } = await supabase
          .from('donations')
          .select('amount');

        const totalDonated = donations?.reduce((sum, d) => sum + Number(d.amount), 0) || 0;

        // Get active projects with their impact
        const { data: projects } = await supabase
          .from('donation_projects')
          .select('families_helped, trees_planted')
          .eq('is_active', true);

        const projectsSupported = projects?.length || 0;
        const familiesHelped = projects?.reduce((sum, p) => sum + p.families_helped, 0) || 0;
        const treesPlanted = projects?.reduce((sum, p) => sum + p.trees_planted, 0) || 0;

        setStats({
          totalDonated,
          projectsSupported,
          familiesHelped,
          treesPlanted,
          isLoading: false,
        });
      } catch (error) {
        console.error('Failed to fetch donation stats:', error);
        setStats(prev => ({ ...prev, isLoading: false }));
      }
    };

    fetchStats();
  }, []);

  return stats;
};
