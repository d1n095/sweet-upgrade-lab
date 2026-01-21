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
    // IMPORTANT: keep auth state listener synchronous (no awaited calls inside)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    // Then fetch existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const userId = user?.id ?? null;

    if (!userId) {
      setProfile(null);
      setUserId(null);
      return;
    }

    setUserId(userId);

    let cancelled = false;

    // Defer DB calls to avoid any auth refresh deadlocks
    setTimeout(() => {
      (async () => {
        try {
          const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

          if (!cancelled) setProfile(data);

          // Sync wishlist with database
          syncWithDatabase(userId);
        } catch (error) {
          console.error('Failed to load profile:', error);
        }
      })();
    }, 0);

    return () => {
      cancelled = true;
    };
  }, [user?.id, setUserId, syncWithDatabase]);

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
