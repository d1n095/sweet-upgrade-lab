import { useRef, useCallback } from 'react';
import { logSecurityEvent } from '@/utils/activityLogger';
import { supabase } from '@/integrations/supabase/client';

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 60 * 1000; // 1 minute lockout

export const useLoginRateLimit = () => {
  const attemptsRef = useRef<{ count: number; firstAttempt: number; lockedUntil: number }>({
    count: 0,
    firstAttempt: 0,
    lockedUntil: 0,
  });

  const checkRateLimit = useCallback((): { allowed: boolean; remainingSeconds?: number } => {
    const now = Date.now();
    const state = attemptsRef.current;

    if (state.lockedUntil > now) {
      const remaining = Math.ceil((state.lockedUntil - now) / 1000);
      return { allowed: false, remainingSeconds: remaining };
    }

    // Reset window if more than 5 min since first attempt
    if (now - state.firstAttempt > 5 * 60 * 1000) {
      state.count = 0;
      state.firstAttempt = now;
    }

    if (state.count === 0) {
      state.firstAttempt = now;
    }

    state.count++;

    if (state.count > MAX_ATTEMPTS) {
      state.lockedUntil = now + LOCKOUT_MS;
      state.count = 0;
      logSecurityEvent('Rate limit: för många inloggningsförsök', {
        attempts: MAX_ATTEMPTS,
        lockout_seconds: LOCKOUT_MS / 1000,
      });
      return { allowed: false, remainingSeconds: Math.ceil(LOCKOUT_MS / 1000) };
    }

    return { allowed: true };
  }, []);

  const resetAttempts = useCallback(() => {
    attemptsRef.current = { count: 0, firstAttempt: 0, lockedUntil: 0 };
  }, []);

  return { checkRateLimit, resetAttempts };
};
