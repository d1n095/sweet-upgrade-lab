import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Minus, Trash2, ShoppingBag, ExternalLink, Loader2, Sparkles, Tag, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCartStore } from '@/stores/cartStore';
import { fetchProducts, ShopifyProduct } from '@/lib/shopify';
import { useLanguage } from '@/context/LanguageContext';
import { useCartDiscounts } from '@/hooks/useCartDiscounts';

interface ShopifyCartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const ShopifyCartDrawer = ({ isOpen, onClose }: ShopifyCartDrawerProps) => {
  const { language } = useLanguage();
  const { 
    items, 
    isLoading, 
    updateQuantity, 
    removeItem, 
    createCheckout,
    addItem
  } = useCartStore();
  
  const { discounts, totalDiscount, getDiscountedTotal } = useCartDiscounts();
  
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [recommendations, setRecommendations] = useState<ShopifyProduct[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(false);

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + (parseFloat(item.price.amount) * item.quantity), 0);
  const finalTotal = getDiscountedTotal();
  const currencyCode = items[0]?.price.currencyCode || 'SEK';

  // Load recommendations when cart opens
  useEffect(() => {
    if (isOpen && items.length > 0) {
      loadRecommendations();
    }
  }, [isOpen, items.length]);

  const loadRecommendations = async () => {
    setLoadingRecs(true);
    try {
      // Fetch all products and filter out ones already in cart
      const allProducts = await fetchProducts(20);
      const cartProductIds = items.map(item => item.product.node.id);
      const filtered = allProducts.filter(p => !cartProductIds.includes(p.node.id));
      
      // Shuffle and take 3 random recommendations
      const shuffled = filtered.sort(() => 0.5 - Math.random());
      setRecommendations(shuffled.slice(0, 3));
    } catch (err) {
      console.error('Failed to load recommendations:', err);
    } finally {
      setLoadingRecs(false);
    }
  };

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

  const handleAddRecommendation = (product: ShopifyProduct) => {
    const variant = product.node.variants.edges[0]?.node;
    if (!variant) return;

    addItem({
      product,
      variantId: variant.id,
      variantTitle: variant.title,
      price: variant.price,
      quantity: 1,
      selectedOptions: variant.selectedOptions || [],
    });

    // Remove from recommendations
    setRecommendations(prev => prev.filter(p => p.node.id !== product.node.id));
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
                {language === 'sv' ? 'Kundvagn' : 'Cart'} ({totalItems})
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
                  <p className="text-muted-foreground">
                    {language === 'sv' ? 'Din kundvagn är tom' : 'Your cart is empty'}
                  </p>
                  <Button className="mt-4" onClick={onClose}>
                    {language === 'sv' ? 'Fortsätt handla' : 'Continue shopping'}
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

                  {/* Recommendations */}
                  {recommendations.length > 0 && (
                    <div className="pt-4 mt-4 border-t border-border">
                      <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="w-4 h-4 text-primary" />
                        <h4 className="font-semibold text-sm">
                          {language === 'sv' ? 'Du kanske också gillar' : 'You might also like'}
                        </h4>
                      </div>
                      <div className="space-y-3">
                        {recommendations.map((product) => {
                          const variant = product.node.variants.edges[0]?.node;
                          const image = product.node.images.edges[0]?.node;
                          if (!variant) return null;

                          return (
                            <motion.div
                              key={product.node.id}
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="flex gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                            >
                              <div className="w-14 h-14 rounded-md bg-muted flex-shrink-0 overflow-hidden">
                                {image && (
                                  <img
                                    src={image.url}
                                    alt={product.node.title}
                                    className="w-full h-full object-cover"
                                  />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h5 className="font-medium text-sm truncate">{product.node.title}</h5>
                                <p className="text-primary text-sm font-semibold">
                                  {formatPrice(parseFloat(variant.price.amount), variant.price.currencyCode)}
                                </p>
                              </div>
                              <Button
                                size="sm"
                                variant="secondary"
                                className="flex-shrink-0 h-8"
                                onClick={() => handleAddRecommendation(product)}
                              >
                                <Plus className="w-4 h-4" />
                              </Button>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {loadingRecs && items.length > 0 && recommendations.length === 0 && (
                    <div className="pt-4 mt-4 border-t border-border">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">
                          {language === 'sv' ? 'Laddar rekommendationer...' : 'Loading recommendations...'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="p-4 border-t border-border space-y-3 bg-card">
                {/* Discounts section */}
                {discounts.length > 0 && (
                  <div className="space-y-2 pb-3 border-b border-border/50">
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>{language === 'sv' ? 'Delsumma' : 'Subtotal'}</span>
                      <span>{formatPrice(subtotal, currencyCode)}</span>
                    </div>
                    {discounts.map((discount, index) => (
                      <div key={index} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-1.5 text-accent">
                          {discount.type === 'bundle' ? (
                            <Package className="w-3.5 h-3.5" />
                          ) : (
                            <Tag className="w-3.5 h-3.5" />
                          )}
                          <span className="font-medium">{discount.name}</span>
                        </div>
                        <span className="text-accent font-medium">
                          -{formatPrice(discount.discountAmount, currencyCode)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between text-lg font-bold">
                  <span>{language === 'sv' ? 'Totalt' : 'Total'}</span>
                  <div className="text-right">
                    <span className="text-primary">{formatPrice(finalTotal, currencyCode)}</span>
                    {totalDiscount > 0 && (
                      <p className="text-xs text-accent font-normal">
                        {language === 'sv' ? 'Du sparar' : 'You save'} {formatPrice(totalDiscount, currencyCode)}
                      </p>
                    )}
                  </div>
                </div>
                <Button 
                  onClick={handleCheckout}
                  className="w-full h-12 text-base font-semibold" 
                  disabled={items.length === 0 || isLoading || isCheckingOut}
                >
                  {isLoading || isCheckingOut ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {language === 'sv' ? 'Skapar kassa...' : 'Creating checkout...'}
                    </>
                  ) : (
                    <>
                      <ExternalLink className="w-4 h-4 mr-2" />
                      {language === 'sv' ? 'Gå till kassan' : 'Go to checkout'}
                    </>
                  )}
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  {language === 'sv' ? 'Frakt beräknas i kassan' : 'Shipping calculated at checkout'}
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
