import { supabase } from '@/integrations/supabase/client';

export async function safeInvoke(name: string, body?: Record<string, any>) {
  const request_id = crypto.randomUUID();

  const res = await supabase.functions.invoke(name, {
    body: { ...(body ?? {}), request_id },
  });

  console.log('[API]', name, request_id, res);

  return res;
}
