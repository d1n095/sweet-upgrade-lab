import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

const WORKBENCH_ROLES = ['admin', 'founder', 'warehouse', 'support', 'moderator', 'it', 'manager'] as const;

export const useStaffAccess = () => {
  const { user, loading: authLoading } = useAuth();
  const [hasAccess, setHasAccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      if (!user) {
        setHasAccess(false);
        setIsLoading(false);
        return;
      }
      try {
        const { data } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .in('role', WORKBENCH_ROLES);
        setHasAccess((data || []).length > 0);
      } catch {
        setHasAccess(false);
      } finally {
        setIsLoading(false);
      }
    };
    if (!authLoading) check();
  }, [user, authLoading]);

  return { hasAccess, isLoading: authLoading || isLoading };
};
