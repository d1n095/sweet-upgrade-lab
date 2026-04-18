import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';
import { useWishlistStore } from '@/stores/wishlistStore';

interface Profile {
  id: string;
  user_id: string;
  is_member: boolean;
  member_since: string | null;
  username: string | null;
  avatar_url: string | null;
  xp: number;
  level: number;
  trust_score: number;
  referral_code: string | null;
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

        }
      })();
    }, 0);

    return () => {
      cancelled = true;
    };
  }, [user?.id, setUserId, syncWithDatabase]);

  const signUp = async (email: string, password: string, username?: string, phone?: string) => {
    const metadata: Record<string, string> = {};
    if (username) metadata.username = username;
    if (phone) metadata.phone = phone;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: Object.keys(metadata).length > 0 ? metadata : undefined,
      },
    });
    // Guard: block user created without id and log security_event
    if (!error && (!data.user || !data.user.id)) {
      supabase.from('security_events').insert({
        type: 'data',
        severity: 'critical',
        message: 'Blocked signup: user created without id',
        endpoint: 'auth.signUp',
      }).then(() => {}, () => {});
      return { data, error: new Error('User created without id') as any };
    }
    // Save phone to profile after signup
    if (!error && data.user && phone) {
      supabase.from('profiles').update({ phone }).eq('user_id', data.user.id).then(() => {});
    }
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

  const maskEmail = (email: string) => {
    const [local, domain] = email.split('@');
    if (!domain) return email;
    const masked = local[0] + '***';
    return `${masked}@${domain}`;
  };

  // Calculate XP needed for next level
  const currentXp = profile?.xp ?? 0;
  const currentLevel = profile?.level ?? 1;
  const xpForCurrentLevel = ((currentLevel - 1) * currentLevel / 2) * 100;
  const xpForNextLevel = (currentLevel * (currentLevel + 1) / 2) * 100;
  const xpProgress = xpForNextLevel > xpForCurrentLevel 
    ? ((currentXp - xpForCurrentLevel) / (xpForNextLevel - xpForCurrentLevel)) * 100 
    : 0;

  return {
    user,
    session,
    profile,
    loading,
    isMember: profile?.is_member ?? false,
    username: profile?.username ?? null,
    avatarUrl: profile?.avatar_url ?? null,
    xp: currentXp,
    level: currentLevel,
    trustScore: profile?.trust_score ?? 0,
    xpProgress: Math.min(100, Math.max(0, xpProgress)),
    xpForNextLevel,
    maskEmail,
    signUp,
    signIn,
    signOut,
    resetPassword,
    updatePassword,
  };
};
