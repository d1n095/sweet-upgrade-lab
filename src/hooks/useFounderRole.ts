import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export const useFounderRole = () => {
  const { user, loading: authLoading } = useAuth();
  const [isFounder, setIsFounder] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      if (!user) {
        setIsFounder(false);
        setIsLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'founder');

        if (error) {
          setIsFounder(false);
        } else {
          setIsFounder((data || []).length > 0);
        }
      } catch {
        setIsFounder(false);
      } finally {
        setIsLoading(false);
      }
    };

    if (!authLoading) check();
  }, [user, authLoading]);

  return { isFounder, isLoading: authLoading || isLoading };
};
