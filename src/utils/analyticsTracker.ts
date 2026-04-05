// Analytics tracker — no-op stubs (tracking removed)

export const trackEvent = async (_eventType: string, _eventData?: Record<string, any>) => {};

export const trackProductView = (_productId: string, _productTitle: string, _price?: number) => {};

export const trackSearch = (_query: string, _resultsCount: number) => {};

export const trackCheckoutStart = (_itemCount: number, _totalAmount: number) => {};

export const trackCheckoutStep = (_step: string, _details?: Record<string, any>) => {};

export const trackCheckoutComplete = (_orderId: string, _totalAmount: number) => {};

export const trackCheckoutAbandon = (_step: string, _itemCount: number, _totalAmount: number) => {};

export const trackPageView = (_pageName: string) => {};

export const trackAddToCart = (_productId: string, _productTitle: string, _price: number, _quantity: number) => {};

export const trackRemoveFromCart = (_productId: string, _productTitle: string, _price: number, _quantity: number) => {};

export const trackCartUpdate = (_productId: string, _productTitle: string, _oldQty: number, _newQty: number) => {};

