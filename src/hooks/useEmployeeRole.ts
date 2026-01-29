import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export const useEmployeeRole = () => {
  const { user, loading: authLoading } = useAuth();
  const [isEmployee, setIsEmployee] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkEmployeeRole = async () => {
      if (!user) {
        setIsEmployee(false);
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'moderator')
          .maybeSingle();

        if (error) {
          console.error('Error checking employee role:', error);
          setIsEmployee(false);
        } else {
          setIsEmployee(!!data);
        }
      } catch (err) {
        console.error('Failed to check employee role:', err);
        setIsEmployee(false);
      } finally {
        setIsLoading(false);
      }
    };

    if (!authLoading) {
      checkEmployeeRole();
    }
  }, [user, authLoading]);

  return { isEmployee, isLoading: authLoading || isLoading };
};
