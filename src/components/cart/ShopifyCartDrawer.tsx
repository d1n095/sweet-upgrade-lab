import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Minus, Trash2, ShoppingBag, ExternalLink, Loader2, Sparkles, Tag, Package, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCartStore } from '@/stores/cartStore';
import { fetchProducts, ShopifyProduct } from '@/lib/shopify';
import { useLanguage, getContentLang } from '@/context/LanguageContext';
import { useCartDiscounts } from '@/hooks/useCartDiscounts';
import { useAuth } from '@/hooks/useAuth';
import ShippingProgressBar from './ShippingProgressBar';
import InfluencerCodeInput from './InfluencerCodeInput';
import RoundUpDonation from './RoundUpDonation';
import LoginIncentives from '@/components/auth/LoginIncentives';
import AuthModal from '@/components/auth/AuthModal';

interface ShopifyCartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const ShopifyCartDrawer = ({ isOpen, onClose }: ShopifyCartDrawerProps) => {
  const { language } = useLanguage();
  const cl = getContentLang(language);
  const { user } = useAuth();
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
  const [showCheckoutView, setShowCheckoutView] = useState(false);
  const [recommendations, setRecommendations] = useState<ShopifyProduct[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [donationAmount, setDonationAmount] = useState(0);
  const [showLoginIncentive, setShowLoginIncentive] = useState(true);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + (parseFloat(item.price.amount) * item.quantity), 0);
  const finalTotal = getDiscountedTotal() + donationAmount;
  const currencyCode = items[0]?.price.currencyCode || 'SEK';

  const content = {
    sv: {
      cart: 'Kundvagn',
      empty: 'Din kundvagn är tom',
      continue: 'Fortsätt handla',
      popular: 'Populära produkter',
      youMightLike: 'Du kanske också gillar',
      loadingRecs: 'Laddar rekommendationer...',
      loadingSuggestions: 'Laddar förslag...',
      add: 'Lägg till',
      subtotal: 'Delsumma',
      total: 'Totalt',
      youSave: 'Du sparar',
      checkout: 'Gå till kassan',
      creatingCheckout: 'Skapar kassa...',
      backToCart: 'Tillbaka till kundvagn',
      orderSummary: 'Ordersammanfattning',
      proceedToPayment: 'Fortsätt till betalning',
    },
    en: {
      cart: 'Cart',
      empty: 'Your cart is empty',
      continue: 'Continue shopping',
      popular: 'Popular products',
      youMightLike: 'You might also like',
      loadingRecs: 'Loading recommendations...',
      loadingSuggestions: 'Loading suggestions...',
      add: 'Add',
      subtotal: 'Subtotal',
      total: 'Total',
      youSave: 'You save',
      checkout: 'Go to checkout',
      creatingCheckout: 'Creating checkout...',
      backToCart: 'Back to cart',
      orderSummary: 'Order summary',
      proceedToPayment: 'Proceed to payment',
    },
  };

  const t = content[cl];

  // Reset checkout view when drawer closes
  useEffect(() => {
    if (!isOpen) setShowCheckoutView(false);
  }, [isOpen]);

  // Load recommendations when cart opens
  useEffect(() => {
    if (isOpen) loadRecommendations();
  }, [isOpen]);

  const loadRecommendations = async () => {
    setLoadingRecs(true);
    try {
      const allProducts = await fetchProducts(20);
      const cartProductIds = items.map(item => item.product.node.id);
      const filtered = allProducts.filter(p => !cartProductIds.includes(p.node.id));
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
            <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
              {showCheckoutView ? (
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowCheckoutView(false)}>
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                  <h2 className="font-display text-lg font-bold">{t.orderSummary}</h2>
                </div>
              ) : (
                <h2 className="font-display text-xl font-bold flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-primary" />
                  {t.cart} ({totalItems})
                </h2>
              )}
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Scrollable content area - full height */}
            <div className="flex-1 overflow-y-auto">
              {items.length === 0 ? (
                <div className="flex flex-col h-full p-4">
                  <div className="text-center py-8">
                    <ShoppingBag className="w-16 h-16 text-muted-foreground/30 mb-4 mx-auto" />
                    <p className="text-muted-foreground">{t.empty}</p>
                  </div>
                  
                  {/* Recommendations for empty cart */}
                  {loadingRecs ? (
                    <div className="flex items-center justify-center gap-2 text-muted-foreground py-8">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">{t.loadingSuggestions}</span>
                    </div>
                  ) : recommendations.length > 0 ? (
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-4">
                        <Sparkles className="w-4 h-4 text-primary" />
                        <h4 className="font-semibold text-sm">{t.popular}</h4>
                      </div>
                      <div className="space-y-3">
                        {recommendations.map((product) => {
                          const variant = product.node.variants.edges[0]?.node;
                          const image = product.node.images.edges[0]?.node;
                          if (!variant) return null;
                          return (
                            <motion.div
                              key={product.node.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="flex gap-3 p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                            >
                              <div className="w-16 h-16 rounded-md bg-muted flex-shrink-0 overflow-hidden">
                                {image && <img src={image.url} alt={product.node.title} className="w-full h-full object-cover" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h5 className="font-medium text-sm truncate">{product.node.title}</h5>
                                <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{product.node.description}</p>
                                <p className="text-primary text-sm font-bold mt-1">
                                  {formatPrice(parseFloat(variant.price.amount), variant.price.currencyCode)}
                                </p>
                              </div>
                              <Button size="sm" className="flex-shrink-0 h-9" onClick={() => handleAddRecommendation(product)}>
                                <Plus className="w-4 h-4 mr-1" />
                                {t.add}
                              </Button>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                  
                  <Button className="mt-auto" variant="outline" onClick={onClose}>
                    {t.continue}
                  </Button>
                </div>
              ) : (
                <div className="p-4 space-y-4">
                  {/* Cart items - always visible */}
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
                          <img src={item.product.node.images.edges[0].node.url} alt={item.product.node.title} className="w-full h-full object-cover" />
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
                          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQuantity(item.variantId, item.quantity - 1)}>
                            <Minus className="w-4 h-4" />
                          </Button>
                          <span className="w-8 text-center font-medium">{item.quantity}</span>
                          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQuantity(item.variantId, item.quantity + 1)}>
                            <Plus className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 ml-auto text-destructive hover:text-destructive" onClick={() => removeItem(item.variantId)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  ))}

                  {/* Shipping progress */}
                  <ShippingProgressBar cartTotal={finalTotal} />

                  {/* Login incentives */}
                  {!user && showLoginIncentive && (
                    <LoginIncentives 
                      onLogin={() => setIsAuthOpen(true)}
                      onContinue={() => setShowLoginIncentive(false)}
                    />
                  )}

                  {/* Influencer code */}
                  <InfluencerCodeInput cartProductIds={items.map(item => item.product.node.id)} />

                  {/* Donation */}
                  <RoundUpDonation
                    cartTotal={getDiscountedTotal()}
                    currencyCode={currencyCode}
                    onDonationChange={setDonationAmount}
                  />

                  {/* Discounts */}
                  {discounts.length > 0 && (
                    <div className="space-y-2 pb-3 border-b border-border/50">
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>{t.subtotal}</span>
                        <span>{formatPrice(subtotal, currencyCode)}</span>
                      </div>
                      {discounts.map((discount, index) => (
                        <div key={index} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-1.5 text-accent">
                            {discount.type === 'bundle' ? <Package className="w-3.5 h-3.5" /> : <Tag className="w-3.5 h-3.5" />}
                            <span className="font-medium">{discount.name}</span>
                          </div>
                          <span className="text-accent font-medium">-{formatPrice(discount.discountAmount, currencyCode)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Recommendations */}
                  {recommendations.length > 0 && (
                    <div className="pt-2 border-t border-border">
                      <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="w-4 h-4 text-primary" />
                        <h4 className="font-semibold text-sm">{t.youMightLike}</h4>
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
                                {image && <img src={image.url} alt={product.node.title} className="w-full h-full object-cover" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h5 className="font-medium text-sm truncate">{product.node.title}</h5>
                                <p className="text-primary text-sm font-semibold">
                                  {formatPrice(parseFloat(variant.price.amount), variant.price.currencyCode)}
                                </p>
                              </div>
                              <Button size="sm" variant="secondary" className="flex-shrink-0 h-8" onClick={() => handleAddRecommendation(product)}>
                                <Plus className="w-4 h-4" />
                              </Button>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {loadingRecs && items.length > 0 && recommendations.length === 0 && (
                    <div className="pt-4 border-t border-border">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">{t.loadingRecs}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Sticky footer */}
            {items.length > 0 && (
              <div className="p-4 border-t border-border space-y-3 bg-card flex-shrink-0">
                <div className="flex items-center justify-between text-lg font-bold">
                  <span>{t.total}</span>
                  <div className="text-right">
                    <span className="text-primary">{formatPrice(finalTotal, currencyCode)}</span>
                    {totalDiscount > 0 && (
                      <p className="text-xs text-accent font-normal">
                        {t.youSave} {formatPrice(totalDiscount, currencyCode)}
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
                      {t.creatingCheckout}
                    </>
                  ) : (
                    <>
                      <ExternalLink className="w-4 h-4 mr-2" />
                      {t.checkout}
                    </>
                  )}
                </Button>
              </div>
            )}
          </motion.div>
        </>
      )}
      
      {/* Auth Modal */}
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </AnimatePresence>
  );
};

export default ShopifyCartDrawer;
