import { supabase } from '@/integrations/supabase/client';

type LogType = 'info' | 'success' | 'error' | 'warning';
type LogCategory = 'order' | 'admin' | 'system' | 'payment' | 'product' | 'auth' | 'security' | 'shipping' | 'campaign' | 'ingredient' | 'recipe' | 'fulfillment';

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
export const logAuthEvent = async (action: 'login' | 'logout' | 'login_failed' | 'signup' | 'password_reset', email?: string, details?: Record<string, any>) => {
  const messages: Record<string, string> = {
    login: `Inloggning: ${email}`,
    logout: `Utloggning: ${email}`,
    login_failed: `Misslyckad inloggning: ${email}`,
    signup: `Ny registrering: ${email}`,
    password_reset: `Lösenordsåterställning: ${email}`,
  };
  try {
    await supabase.from('activity_logs').insert({
      log_type: action === 'login_failed' ? 'warning' : 'info',
      category: 'auth',
      message: messages[action] || action,
      details: { action, email, ...(details || {}), timestamp: new Date().toISOString() },
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
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
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

// Product changes
export const logProductChange = async (action: 'created' | 'updated' | 'deleted' | 'visibility_changed', productName: string, details?: Record<string, any>) => {
  const messages: Record<string, string> = {
    created: `Produkt skapad: ${productName}`,
    updated: `Produkt uppdaterad: ${productName}`,
    deleted: `Produkt borttagen: ${productName}`,
    visibility_changed: `Produktsynlighet ändrad: ${productName}`,
  };
  await logActivity({ log_type: action === 'deleted' ? 'warning' : 'info', category: 'product', message: messages[action], details });
};

// Ingredient changes
export const logIngredientChange = async (action: 'created' | 'updated' | 'deleted', name: string, details?: Record<string, any>) => {
  await logActivity({ log_type: 'info', category: 'ingredient', message: `Ingrediens ${action === 'created' ? 'tillagd' : action === 'updated' ? 'uppdaterad' : 'borttagen'}: ${name}`, details });
};

// Recipe template changes
export const logRecipeChange = async (action: 'created' | 'updated' | 'deleted' | 'slot_added' | 'slot_removed', name: string, details?: Record<string, any>) => {
  const msg: Record<string, string> = {
    created: `Receptmall skapad: ${name}`,
    updated: `Receptmall uppdaterad: ${name}`,
    deleted: `Receptmall borttagen: ${name}`,
    slot_added: `Steg tillagt i receptmall: ${name}`,
    slot_removed: `Steg borttaget från receptmall: ${name}`,
  };
  await logActivity({ log_type: 'info', category: 'recipe', message: msg[action], details });
};

// Shipping changes
export const logShippingChange = async (action: string, details?: Record<string, any>) => {
  await logActivity({ log_type: 'info', category: 'shipping', message: action, details });
};

// Campaign/discount changes
export const logCampaignChange = async (action: string, details?: Record<string, any>) => {
  await logActivity({ log_type: 'info', category: 'campaign', message: action, details });
};
