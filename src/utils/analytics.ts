// Analytics utility — no-op stubs (tracking removed)

export const trackPageView = (_pageName: string, _language?: string) => {};

export const trackEvent = (_params: { category: string; action: string; label?: string; value?: number }) => {};

export const trackProductView = (_productId: string, _productName: string, _price: number) => {};

export const trackAddToCart = (_productId: string, _productName: string, _price: number, _quantity: number) => {};

export const trackCheckoutStart = (_cartTotal: number, _itemCount: number) => {};

export const trackNewsletterSignup = (_email: string) => {};

