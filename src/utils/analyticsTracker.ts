import { supabase } from '@/integrations/supabase/client';

const getSessionId = () => {
  let sessionId = sessionStorage.getItem('analytics_session_id');
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem('analytics_session_id', sessionId);
  }
  return sessionId;
};

const getReferralCode = (): string | null => {
  return sessionStorage.getItem('referral_code') || null;
};

const getUserId = async (): Promise<string | null> => {
  try {
    const { data } = await supabase.auth.getUser();
    return data.user?.id || null;
  } catch {
    return null;
  }
};

export const trackEvent = async (eventType: string, eventData: Record<string, any> = {}) => {
  try {
    const userId = await getUserId();
    const referralCode = getReferralCode();
    
    // Attach referral_code to every event if present
    const enrichedData = {
      ...eventData,
      ...(referralCode ? { referral_code: referralCode } : {}),
    };

    await supabase.from('analytics_events').insert({
      event_type: eventType,
      event_data: enrichedData,
      session_id: getSessionId(),
      user_id: userId,
    });
  } catch {
    // Silent fail — analytics should never break UX
  }
};

// Product view tracking
export const trackProductView = (productId: string, productTitle: string, price?: number) => {
  trackEvent('product_view', { product_id: productId, product_title: productTitle, price });
};

// Search tracking
export const trackSearch = (query: string, resultsCount: number) => {
  trackEvent('search', { query, results_count: resultsCount });
};

// Checkout funnel tracking
export const trackCheckoutStart = (itemCount: number, totalAmount: number) => {
  trackEvent('checkout_start', { item_count: itemCount, total_amount: totalAmount });
};

export const trackCheckoutStep = (step: string, details?: Record<string, any>) => {
  trackEvent('checkout_step', { step, ...details });
};

export const trackCheckoutComplete = (orderId: string, totalAmount: number) => {
  trackEvent('checkout_complete', { order_id: orderId, total_amount: totalAmount });
};

export const trackCheckoutAbandon = (step: string, itemCount: number, totalAmount: number) => {
  trackEvent('checkout_abandon', { step, item_count: itemCount, total_amount: totalAmount });
};

// Page view tracking
export const trackPageView = (pageName: string) => {
  trackEvent('page_view', { page: pageName, url: window.location.pathname });
};

// Cart events
export const trackAddToCart = (productId: string, productTitle: string, price: number, quantity: number) => {
  trackEvent('add_to_cart', { product_id: productId, product_title: productTitle, price, quantity });
};

export const trackRemoveFromCart = (productId: string, productTitle: string, price: number, quantity: number) => {
  trackEvent('remove_from_cart', { product_id: productId, product_title: productTitle, price, quantity });
};

export const trackCartUpdate = (productId: string, productTitle: string, oldQty: number, newQty: number) => {
  trackEvent('cart_update', { product_id: productId, product_title: productTitle, old_quantity: oldQty, new_quantity: newQty });
};
