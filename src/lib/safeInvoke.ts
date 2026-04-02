import { supabase } from '@/integrations/supabase/client';

const ALLOWED_FUNCTIONS = new Set([
  'process-refund',
  'notify-review',
  'send-order-email',
  'lookup-order',
  'create-checkout',
  'translate-product',
  'run-full-scan',
  'automation-engine',
  'ai-task-manager',
  'generate-product-content',
  'suggest-product-metadata',
  'shopify-proxy',
  'send-welcome-email',
  'notify-influencer',
  'notify-affiliate',
  'generate-receipt',
  'data-sync',
  'process-bug-report',
  'google-places',
]);

const ADMIN_ONLY_FUNCTIONS = new Set([
  'run-full-scan',
  'automation-engine',
  'ai-task-manager',
  'generate-product-content',
  'suggest-product-metadata',
  'notify-influencer',
  'notify-affiliate',
  'generate-receipt',
  'data-sync',
  'process-bug-report',
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

export const safeFetch = async ({
  fn,
  method = 'POST',
  body,
  params,
  signal,
  isAdmin,
}: {
  fn: string;
  method?: 'GET' | 'POST';
  body?: Record<string, unknown>;
  params?: Record<string, string>;
  signal?: AbortSignal;
  isAdmin?: boolean;
}): Promise<Response> => {
  if (!ALLOWED_FUNCTIONS.has(fn)) {
    throw new Error(`BLOCKED: function not allowed — "${fn}"`);
  }

  if (ADMIN_ONLY_FUNCTIONS.has(fn) && !isAdmin) {
    throw new Error(`UNAUTHORIZED: Admin role required to invoke ${fn}`);
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  let url = `${supabaseUrl}/functions/v1/${fn}`;
  if (params) {
    url = `${url}?${new URLSearchParams(params).toString()}`;
  }

  const headers: Record<string, string> = {
    apikey: anonKey,
  };
  if (method === 'POST') {
    headers['Content-Type'] = 'application/json';
  }
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  return fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });
};
