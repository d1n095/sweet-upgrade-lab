import { logActivity } from '@/utils/activityLogger';

export const trackAddToCart = (productId: string, title: string, price: number, quantity: number): void => {
  logActivity({
    log_type: 'info',
    category: 'product',
    message: `Produkt tillagd i varukorg: ${title}`,
    details: { productId, price, quantity },
  });
};

export const trackRemoveFromCart = (productId: string, title: string, price: number, quantity: number): void => {
  logActivity({
    log_type: 'info',
    category: 'product',
    message: `Produkt borttagen från varukorg: ${title}`,
    details: { productId, price, quantity },
  });
};

export const trackCartUpdate = (productId: string, title: string, oldQuantity: number, newQuantity: number): void => {
  logActivity({
    log_type: 'info',
    category: 'product',
    message: `Varukorgskvantitet uppdaterad: ${title}`,
    details: { productId, oldQuantity, newQuantity },
  });
};
