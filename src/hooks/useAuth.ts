import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';
import { useWishlistStore } from '@/stores/wishlistStore';

interface Profile {
  id: string;
  user_id: string;
  is_member: boolean;
  member_since: string | null;
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const { syncWithDatabase, setUserId, clearLocalWishlist } = useWishlistStore();

  useEffect(() => {
    // Get initial session first
    const initializeAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        setSession(session);
        setUser(session.user);
        
        // Fetch profile
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', session.user.id)
          .maybeSingle();
        
        setProfile(data);
        
        // Sync wishlist
        syncWithDatabase(session.user.id);
      }
      
      setLoading(false);
    };

    initializeAuth();

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Avoid resetting state on INITIAL_SESSION if we already have data
        if (event === 'INITIAL_SESSION') return;
        
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Fetch profile
          const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', session.user.id)
            .maybeSingle();
          
          setProfile(data);
          
          // Sync wishlist with database
          syncWithDatabase(session.user.id);
        } else {
          setProfile(null);
          setUserId(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [syncWithDatabase, setUserId]);

  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });
    return { data, error };
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  };

  const signOut = async () => {
    clearLocalWishlist();
    setUser(null);
    setSession(null);
    setProfile(null);
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error };
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    return { error };
  };

  return {
    user,
    session,
    profile,
    loading,
    isMember: profile?.is_member ?? false,
    signUp,
    signIn,
    signOut,
    resetPassword,
    updatePassword,
  };
};
