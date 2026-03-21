import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Minus, Trash2, ShoppingBag, Loader2, Tag, Package, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCartStore } from '@/stores/cartStore';
import { useLanguage, getContentLang } from '@/context/LanguageContext';
import { useCartDiscounts } from '@/hooks/useCartDiscounts';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import ShippingProgressBar from './ShippingProgressBar';
import CartReservationTimer from './CartReservationTimer';
import LoginIncentives from '@/components/auth/LoginIncentives';
import AuthModal from '@/components/auth/AuthModal';

interface ShopifyCartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface RecommendedProduct {
  id: string;
  title_sv: string;
  handle: string | null;
  price: number;
  image_urls: string[] | null;
}

const ShopifyCartDrawer = ({ isOpen, onClose }: ShopifyCartDrawerProps) => {
  const { language } = useLanguage();
  const cl = getContentLang(language);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { items, isLoading, updateQuantity, removeItem, addItem } = useCartStore();
  const { discounts, totalDiscount, getDiscountedTotal } = useCartDiscounts();
  const [showLoginIncentive, setShowLoginIncentive] = useState(true);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [recommended, setRecommended] = useState<RecommendedProduct[]>([]);

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + (parseFloat(item.price.amount) * item.quantity), 0);
  const finalTotal = getDiscountedTotal();
  const currencyCode = items[0]?.price.currencyCode || 'SEK';

  // Load recommended products based on cart items
  useEffect(() => {
    if (!isOpen || items.length === 0) { setRecommended([]); return; }
    const loadRecommended = async () => {
      const cartProductIds = items.map(i => (i.product as any)?.dbId || i.product?.node?.id).filter(Boolean);
      if (cartProductIds.length === 0) return;

      // Get tags of cart products
      const { data: tagRels } = await supabase
        .from('product_tag_relations')
        .select('tag_id')
        .in('product_id', cartProductIds);
      const tagIds = [...new Set((tagRels || []).map(r => r.tag_id))];

      if (tagIds.length === 0) {
        // Fallback: random products
        const { data } = await supabase
          .from('products')
          .select('id, title_sv, handle, price, image_urls')
          .eq('is_visible', true).eq('status', 'active')
          .not('id', 'in', `(${cartProductIds.join(',')})`)
          .limit(3);
        setRecommended((data || []) as RecommendedProduct[]);
        return;
      }

      // Get products with same tags
      const { data: relatedRels } = await supabase
        .from('product_tag_relations')
        .select('product_id')
        .in('tag_id', tagIds)
        .not('product_id', 'in', `(${cartProductIds.join(',')})`);
      const relatedIds = [...new Set((relatedRels || []).map(r => r.product_id))].slice(0, 4);

      if (relatedIds.length === 0) { setRecommended([]); return; }

      const { data } = await supabase
        .from('products')
        .select('id, title_sv, handle, price, image_urls')
        .in('id', relatedIds)
        .eq('is_visible', true)
        .eq('status', 'active');
      setRecommended((data || []) as RecommendedProduct[]);
    };
    loadRecommended();
  }, [isOpen, items]);

  const t = {
    sv: { cart: 'Kundvagn', empty: 'Din kundvagn är tom', continue: 'Fortsätt handla', subtotal: 'Delsumma', total: 'Totalt', youSave: 'Du sparar', checkout: 'Till kassan – säkra din order', recommended: 'Köps ofta tillsammans', addFor: 'Lägg till för' },
    en: { cart: 'Cart', empty: 'Your cart is empty', continue: 'Continue shopping', subtotal: 'Subtotal', total: 'Total', youSave: 'You save', checkout: 'Checkout – secure your order', recommended: 'Frequently bought together', addFor: 'Add for' },
  }[cl as 'sv' | 'en'] || { cart: 'Cart', empty: 'Your cart is empty', continue: 'Continue shopping', subtotal: 'Subtotal', total: 'Total', youSave: 'You save', checkout: 'Checkout – secure your order', recommended: 'Frequently bought together', addFor: 'Add for' };

  const formatPrice = (price: number, currency: string) =>
    new Intl.NumberFormat('sv-SE', { style: 'currency', currency, minimumFractionDigits: 0 }).format(price);

  const handleCheckout = () => {
    onClose();
    navigate('/checkout');
  };

  const handleAddRecommended = (product: RecommendedProduct) => {
    const cartProduct = {
      dbId: product.id,
      node: {
        id: product.id,
        title: product.title_sv,
        handle: product.handle || product.id,
        description: '',
        productType: '',
        tags: [],
        priceRange: { minVariantPrice: { amount: product.price.toString(), currencyCode: 'SEK' } },
        images: { edges: product.image_urls?.[0] ? [{ node: { url: product.image_urls[0], altText: product.title_sv } }] : [] },
        variants: { edges: [{ node: { id: product.id + '-variant', title: 'Default', availableForSale: true, price: { amount: product.price.toString(), currencyCode: 'SEK' }, selectedOptions: [] } }] },
      }
    } as any;
    addItem({ product: cartProduct, variantId: product.id + '-variant', variantTitle: 'Default', price: { amount: product.price.toString(), currencyCode: 'SEK' }, quantity: 1, selectedOptions: [] });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[60]" />
          <motion.div
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-full max-w-md bg-card border-l border-border z-[60] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
              <h2 className="font-display text-xl font-bold flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-primary" />
                {t.cart} ({totalItems})
              </h2>
              <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto">
              {items.length === 0 ? (
                <div className="flex flex-col h-full p-4">
                  <div className="text-center py-8 flex-1 flex flex-col items-center justify-center">
                    <ShoppingBag className="w-16 h-16 text-muted-foreground/30 mb-4" />
                    <p className="text-muted-foreground mb-1">{t.empty}</p>
                  </div>
                  <Button variant="outline" onClick={() => { onClose(); navigate('/produkter'); }} className="gap-2">
                    <Package className="w-4 h-4" />{cl === 'sv' ? 'Börja handla' : 'Start shopping'}
                  </Button>
                </div>
              ) : (
                <div className="p-4 space-y-4">
                  {items.map((item) => (
                    <motion.div key={item.variantId} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -100 }} className="flex gap-4 p-4 rounded-lg bg-secondary/50">
                      <div className="w-20 h-20 rounded-lg bg-muted flex-shrink-0 overflow-hidden">
                        {item.product.node.images?.edges?.[0]?.node && (
                          <img src={item.product.node.images.edges[0].node.url} alt={item.product.node.title} loading="lazy" className="w-full h-full object-cover" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm truncate">{item.product.node.title}</h3>
                        {item.variantTitle !== 'Default Title' && item.variantTitle !== 'Default' && (
                          <p className="text-xs text-muted-foreground">{item.variantTitle}</p>
                        )}
                        <p className="text-primary font-bold mt-1">{formatPrice(parseFloat(item.price.amount), item.price.currencyCode)}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQuantity(item.variantId, item.quantity - 1)}><Minus className="w-4 h-4" /></Button>
                          <span className="w-8 text-center font-medium">{item.quantity}</span>
                          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQuantity(item.variantId, item.quantity + 1)}><Plus className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 ml-auto text-destructive hover:text-destructive" onClick={() => removeItem(item.variantId)}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </div>
                    </motion.div>
                  ))}

                  <ShippingProgressBar cartTotal={finalTotal} />

                  <CartReservationTimer lang={cl} />

                  {/* Trust signals */}
                  <div className="flex items-center justify-center gap-4 py-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">🛡 {cl === 'sv' ? '30 dagars garanti' : '30-day guarantee'}</span>
                    <span className="text-border">•</span>
                    <span className="flex items-center gap-1">🔒 {cl === 'sv' ? 'Säker betalning' : 'Secure payment'}</span>
                  </div>

                  {!user && showLoginIncentive && (
                    <LoginIncentives onLogin={() => setIsAuthOpen(true)} onContinue={() => setShowLoginIncentive(false)} />
                  )}

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

                  {/* Recommended products */}
                  {recommended.length > 0 && (
                    <div className="pt-3 border-t border-border/50">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">{t.recommended}</p>
                      <div className="space-y-2">
                        {recommended.map(product => (
                          <div key={product.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/30 transition-colors">
                            <Link
                              to={`/product/${product.handle || product.id}`}
                              onClick={onClose}
                              className="w-12 h-12 rounded-lg bg-muted overflow-hidden flex-shrink-0"
                            >
                              {product.image_urls?.[0] ? (
                                <img src={product.image_urls[0]} alt={product.title_sv} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center"><Package className="w-4 h-4 text-muted-foreground" /></div>
                              )}
                            </Link>
                            <div className="flex-1 min-w-0">
                              <Link to={`/product/${product.handle || product.id}`} onClick={onClose}>
                                <p className="text-sm font-medium truncate">{product.title_sv}</p>
                              </Link>
                              <p className="text-xs font-semibold text-primary">+{formatPrice(product.price, 'SEK')}</p>
                            </div>
                            <Button size="sm" variant="outline" className="shrink-0 rounded-lg text-xs gap-1" onClick={() => handleAddRecommended(product)}>
                              <Plus className="w-3 h-3" />
                              {cl === 'sv' ? 'Lägg till' : 'Add'}
                            </Button>
                          </div>
                        ))}
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
                      <p className="text-xs text-accent font-normal">{t.youSave} {formatPrice(totalDiscount, currencyCode)}</p>
                    )}
                  </div>
                </div>
                <Button onClick={handleCheckout} className="w-full h-12 text-base font-semibold" disabled={items.length === 0 || isLoading}>
                  <ArrowRight className="w-4 h-4 mr-2" />{t.checkout}
                </Button>
              </div>
            )}
          </motion.div>
        </>
      )}
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </AnimatePresence>
  );
};

export default ShopifyCartDrawer;
