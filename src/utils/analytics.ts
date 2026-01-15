// Analytics utility for tracking page views and events
// Can be extended with Google Analytics, Meta Pixel, etc.

type EventCategory = 'page' | 'product' | 'cart' | 'checkout' | 'engagement';

interface TrackEventParams {
  category: EventCategory;
  action: string;
  label?: string;
  value?: number;
}

// Track page views
export const trackPageView = (pageName: string, language: string) => {
  const data = {
    page: pageName,
    language,
    timestamp: new Date().toISOString(),
    url: window.location.href,
  };

  // Log for development
  if (import.meta.env.DEV) {
    console.log('[Analytics] Page View:', data);
  }

  // TODO: Send to analytics service
  // gtag('event', 'page_view', { page_title: pageName });
  // fbq('track', 'PageView');
};

// Track custom events
export const trackEvent = ({ category, action, label, value }: TrackEventParams) => {
  const data = {
    category,
    action,
    label,
    value,
    timestamp: new Date().toISOString(),
  };

  if (import.meta.env.DEV) {
    console.log('[Analytics] Event:', data);
  }

  // TODO: Send to analytics service
  // gtag('event', action, { event_category: category, event_label: label, value });
};

// E-commerce specific tracking
export const trackProductView = (productId: string, productName: string, price: number) => {
  trackEvent({
    category: 'product',
    action: 'view',
    label: `${productName} (${productId})`,
    value: price,
  });
};

export const trackAddToCart = (productId: string, productName: string, price: number, quantity: number) => {
  trackEvent({
    category: 'cart',
    action: 'add',
    label: `${productName} (${productId})`,
    value: price * quantity,
  });
};

export const trackCheckoutStart = (cartTotal: number, itemCount: number) => {
  trackEvent({
    category: 'checkout',
    action: 'start',
    label: `${itemCount} items`,
    value: cartTotal,
  });
};

export const trackNewsletterSignup = (email: string) => {
  trackEvent({
    category: 'engagement',
    action: 'newsletter_signup',
    label: email.split('@')[1], // Track domain only for privacy
  });
};
