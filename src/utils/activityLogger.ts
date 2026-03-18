import { supabase } from '@/integrations/supabase/client';

type LogType = 'info' | 'success' | 'error' | 'warning';
type LogCategory = 'order' | 'admin' | 'system' | 'payment' | 'product' | 'auth' | 'security';

interface LogEntry {
  log_type: LogType;
  category: LogCategory;
  message: string;
  details?: Record<string, any>;
  order_id?: string;
}

export const logActivity = async (entry: LogEntry) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('activity_logs').insert({
      log_type: entry.log_type,
      category: entry.category,
      message: entry.message,
      details: {
        ...(entry.details || {}),
        user_email: user?.email || null,
        timestamp: new Date().toISOString(),
      },
      order_id: entry.order_id || null,
      user_id: user?.id || null,
    });
  } catch (e) {
    console.error('Failed to log activity:', e);
  }
};

// Login/logout tracking
export const logAuthEvent = async (action: 'login' | 'logout' | 'login_failed', email?: string, details?: Record<string, any>) => {
  try {
    await supabase.from('activity_logs').insert({
      log_type: action === 'login_failed' ? 'warning' : 'info',
      category: 'auth',
      message: action === 'login' ? `Inloggning: ${email}` 
        : action === 'logout' ? `Utloggning: ${email}`
        : `Misslyckad inloggning: ${email}`,
      details: {
        action,
        email,
        ...(details || {}),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (e) {
    console.error('Failed to log auth event:', e);
  }
};

// Security event tracking
export const logSecurityEvent = async (message: string, details?: Record<string, any>) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('activity_logs').insert({
      log_type: 'warning',
      category: 'security',
      message,
      details: {
        ...(details || {}),
        user_id: user?.id || null,
        user_email: user?.email || null,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (e) {
    console.error('Failed to log security event:', e);
  }
};

// Settings change tracking
export const logSettingsChange = async (setting: string, oldValue: any, newValue: any) => {
  await logActivity({
    log_type: 'info',
    category: 'admin',
    message: `Inställning ändrad: ${setting}`,
    details: { setting, old_value: oldValue, new_value: newValue },
  });
};
