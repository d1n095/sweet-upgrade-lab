import { safeInvoke } from '@/lib/safeInvoke';

/**
 * @deprecated Use safeInvoke from '@/lib/safeInvoke' directly.
 * This shim exists for backwards compatibility during migration.
 */
export async function tracedInvoke<T = any>(
  functionName: string,
  options?: { body?: Record<string, any>; headers?: Record<string, string>; isAdmin?: boolean }
): Promise<{ data: T | null; error: any; request_trace_id: string }> {
  const { data, error, traceId } = await safeInvoke<T>(functionName, options);
  return { data, error, request_trace_id: traceId };
}
