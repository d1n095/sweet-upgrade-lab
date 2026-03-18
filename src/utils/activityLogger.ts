import { supabase } from '@/integrations/supabase/client';

type LogType = 'info' | 'success' | 'error' | 'warning';
type LogCategory = 'order' | 'admin' | 'system' | 'payment' | 'product';

interface LogEntry {
  log_type: LogType;
  category: LogCategory;
  message: string;
  details?: Record<string, any>;
  order_id?: string;
}

export const logActivity = async (entry: LogEntry) => {
  try {
    await supabase.from('activity_logs').insert({
      log_type: entry.log_type,
      category: entry.category,
      message: entry.message,
      details: entry.details || {},
      order_id: entry.order_id || null,
    });
  } catch (e) {
    console.error('Failed to log activity:', e);
  }
};
