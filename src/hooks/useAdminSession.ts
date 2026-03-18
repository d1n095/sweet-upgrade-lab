import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from './useAuth';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { logSecurityEvent } from '@/utils/activityLogger';

const ADMIN_SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes of inactivity
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll'];

export const useAdminSession = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef(Date.now());

  const handleTimeout = useCallback(async () => {
    if (!user) return;
    await logSecurityEvent('Admin session timeout — automatisk utloggning', {
      user_email: user.email,
      inactive_minutes: 30,
    });
    await signOut();
    toast.warning('Du har loggats ut på grund av inaktivitet');
    navigate('/');
  }, [user, signOut, navigate]);

  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(handleTimeout, ADMIN_SESSION_TIMEOUT);
  }, [handleTimeout]);

  useEffect(() => {
    if (!user) return;

    resetTimer();

    const onActivity = () => resetTimer();
    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, onActivity, { passive: true }));

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, onActivity));
    };
  }, [user, resetTimer]);

  return { lastActivity: lastActivityRef };
};
