
-- Fix: notifications INSERT should only allow staff or service_role, not everyone
DROP POLICY "System can create notifications" ON public.notifications;
CREATE POLICY "Staff or triggers can create notifications" ON public.notifications
  FOR INSERT WITH CHECK (is_staff(auth.uid()) OR auth.role() = 'service_role');

-- Fix search_path on new functions
ALTER FUNCTION public.notify_on_incident() SET search_path = public;
ALTER FUNCTION public.notify_on_refund_request() SET search_path = public;
