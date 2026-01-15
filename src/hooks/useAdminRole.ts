import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export const useAdminRole = () => {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAdminRole = async () => {
      if (!user) {
        setIsAdmin(false);
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'admin')
          .maybeSingle();

        if (error) {
          console.error('Error checking admin role:', error);
          setIsAdmin(false);
        } else {
          setIsAdmin(!!data);
        }
      } catch (err) {
        console.error('Failed to check admin role:', err);
        setIsAdmin(false);
      } finally {
        setIsLoading(false);
      }
    };

    if (!authLoading) {
      checkAdminRole();
    }
  }, [user, authLoading]);

  return { isAdmin, isLoading: authLoading || isLoading };
};
