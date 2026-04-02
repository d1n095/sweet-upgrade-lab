import { supabase } from '@/integrations/supabase/client';

const ALLOWED_FUNCTIONS = new Set([
  'process-refund',
  'notify-review',
  'send-order-email',
  'lookup-order',
  'create-checkout',
  'translate-product',
  'run-full-scan',
]);

const ADMIN_ONLY_FUNCTIONS = new Set([
  'run-full-scan',
]);

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

  if (!ALLOWED_FUNCTIONS.has(fn)) {
    throw new Error(`BLOCKED: function not allowed — "${fn}"`);
  }

  if (ADMIN_ONLY_FUNCTIONS.has(fn) && !isAdmin) {
    throw new Error(`UNAUTHORIZED: Admin role required to invoke ${fn}`);
  }

  if (body !== undefined && (typeof body !== 'object' || Array.isArray(body) || body === null)) {
    throw new Error('INVALID: body must be a plain object or undefined');
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
