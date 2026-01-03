import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Minus, Trash2, ShoppingBag, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCartStore } from '@/stores/cartStore';

interface ShopifyCartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const ShopifyCartDrawer = ({ isOpen, onClose }: ShopifyCartDrawerProps) => {
  const { 
    items, 
    isLoading, 
    updateQuantity, 
    removeItem, 
    createCheckout,
    checkoutUrl
  } = useCartStore();
  
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce((sum, item) => sum + (parseFloat(item.price.amount) * item.quantity), 0);
  const currencyCode = items[0]?.price.currencyCode || 'SEK';

  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
    }).format(price);
  };

  const handleCheckout = async () => {
    setIsCheckingOut(true);
    try {
      await createCheckout();
      const url = useCartStore.getState().checkoutUrl;
      if (url) {
        window.open(url, '_blank');
        onClose();
      }
    } catch (error) {
      console.error('Checkout failed:', error);
    } finally {
      setIsCheckingOut(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-full max-w-md bg-card border-l border-border z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="font-display text-xl font-bold flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-primary" />
                Kundvagn ({totalItems})
              </h2>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <ShoppingBag className="w-16 h-16 text-muted-foreground/30 mb-4" />
                  <p className="text-muted-foreground">Din kundvagn är tom</p>
                  <Button className="mt-4" onClick={onClose}>
                    Fortsätt handla
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {items.map((item) => (
                    <motion.div
                      key={item.variantId}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -100 }}
                      className="flex gap-4 p-4 rounded-lg bg-secondary/50"
                    >
                      <div className="w-20 h-20 rounded-lg bg-muted flex-shrink-0 overflow-hidden">
                        {item.product.node.images?.edges?.[0]?.node && (
                          <img
                            src={item.product.node.images.edges[0].node.url}
                            alt={item.product.node.title}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm truncate">{item.product.node.title}</h3>
                        {item.variantTitle !== 'Default Title' && (
                          <p className="text-xs text-muted-foreground">{item.variantTitle}</p>
                        )}
                        <p className="text-primary font-bold mt-1">
                          {formatPrice(parseFloat(item.price.amount), item.price.currencyCode)}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                          >
                            <Minus className="w-4 h-4" />
                          </Button>
                          <span className="w-8 text-center font-medium">{item.quantity}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 ml-auto text-destructive hover:text-destructive"
                            onClick={() => removeItem(item.variantId)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="p-4 border-t border-border space-y-4 bg-card">
                <div className="flex items-center justify-between text-lg font-bold">
                  <span>Totalt</span>
                  <span className="text-primary">{formatPrice(totalPrice, currencyCode)}</span>
                </div>
                <Button 
                  onClick={handleCheckout}
                  className="w-full h-12 text-base font-semibold" 
                  disabled={items.length === 0 || isLoading || isCheckingOut}
                >
                  {isLoading || isCheckingOut ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Skapar kassa...
                    </>
                  ) : (
                    <>
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Gå till kassan
                    </>
                  )}
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  Frakt beräknas i kassan
                </p>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ShopifyCartDrawer;
