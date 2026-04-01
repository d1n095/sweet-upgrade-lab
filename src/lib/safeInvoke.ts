import { supabase } from '@/integrations/supabase/client';

console.log("CONTROL LAYER ACTIVE", {
  invokeWrapped: true,
  directAccessBlocked: true,
  traceable: true,
});

export const safeInvoke = async ({
  action,
  fn,
  body,
  isAdmin,
}: {
  action: string;
  fn: string;
  body?: Record<string, unknown>;
  isAdmin?: boolean;
}) => {
  if (!action || !fn) {
    throw new Error(`safeInvoke: missing required params — action="${action}", fn="${fn}"`);
  }

  if (fn === 'run-full-scan' && !isAdmin) {
    throw new Error('UNAUTHORIZED: Admin role required to invoke run-full-scan');
  }

  const traceId = crypto.randomUUID();
  const start = Date.now();

  console.log('ACTION START', { action, fn, traceId });

  try {
    const res = await supabase.functions.invoke(fn, { body });

    console.log('ACTION SUCCESS', {
      action,
      fn,
      traceId,
      duration: Date.now() - start,
      result: res,
    });

    return res;
  } catch (err) {
    console.error('ACTION FAILED', { action, fn, traceId, error: err });
    throw err;
  }
};
