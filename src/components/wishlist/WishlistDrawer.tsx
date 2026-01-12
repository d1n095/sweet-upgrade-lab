import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, X, ShoppingCart, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useWishlistStore } from '@/stores/wishlistStore';
import { useCartStore } from '@/stores/cartStore';
import { useLanguage } from '@/context/LanguageContext';
import { Link } from 'react-router-dom';
import { ShopifyProduct } from '@/lib/shopify';

interface WishlistDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const WishlistDrawer = ({ isOpen, onClose }: WishlistDrawerProps) => {
  const { language } = useLanguage();
  const { items, removeItem, clearWishlist } = useWishlistStore();
  const { addItem: addToCart } = useCartStore();
  const [addedItems, setAddedItems] = useState<Set<string>>(new Set());

  const formatPrice = (amount: string, currency: string) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
    }).format(parseFloat(amount));
  };

  const handleAddToCart = (product: ShopifyProduct) => {
    const firstVariant = product.node.variants.edges[0]?.node;
    if (!firstVariant) return;

    addToCart({
      product,
      variantId: firstVariant.id,
      variantTitle: firstVariant.title,
      price: firstVariant.price,
      quantity: 1,
      selectedOptions: firstVariant.selectedOptions || []
    });

    setAddedItems(prev => new Set(prev).add(product.node.id));
    setTimeout(() => {
      setAddedItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(product.node.id);
        return newSet;
      });
    }, 1500);
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
            className="fixed right-0 top-0 h-full w-full max-w-md bg-background border-l border-border z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Heart className="w-5 h-5 text-red-500 fill-current" />
                <h2 className="font-display text-lg font-semibold">
                  {language === 'sv' ? 'Önskelista' : 'Wishlist'}
                </h2>
                {items.length > 0 && (
                  <Badge variant="secondary">{items.length}</Badge>
                )}
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center mb-4">
                    <Heart className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold mb-2">
                    {language === 'sv' ? 'Din önskelista är tom' : 'Your wishlist is empty'}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {language === 'sv' 
                      ? 'Spara produkter du gillar för att hitta dem enkelt senare'
                      : 'Save products you like to find them easily later'
                    }
                  </p>
                  <Button onClick={onClose} variant="outline">
                    {language === 'sv' ? 'Utforska produkter' : 'Explore products'}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {items.map((product) => {
                    const imageUrl = product.node.images.edges[0]?.node.url;
                    const price = product.node.priceRange.minVariantPrice;
                    const isAdded = addedItems.has(product.node.id);

                    return (
                      <motion.div
                        key={product.node.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: 50 }}
                        className="glass-card p-3 flex gap-3"
                      >
                        {/* Image */}
                        <Link 
                          to={`/product/${product.node.handle}`} 
                          onClick={onClose}
                          className="relative w-20 h-20 rounded-lg overflow-hidden bg-secondary/50 flex-shrink-0"
                        >
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={product.node.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                              Ingen bild
                            </div>
                          )}
                        </Link>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <Link 
                            to={`/product/${product.node.handle}`} 
                            onClick={onClose}
                            className="font-semibold text-sm hover:text-primary transition-colors line-clamp-2"
                          >
                            {product.node.title}
                          </Link>
                          <p className="text-primary font-bold mt-1">
                            {formatPrice(price.amount, price.currencyCode)}
                          </p>
                          
                          {/* Actions */}
                          <div className="flex items-center gap-2 mt-2">
                            <Button
                              size="sm"
                              onClick={() => handleAddToCart(product)}
                              className={`h-7 text-xs flex-1 transition-all ${isAdded ? 'bg-green-600 hover:bg-green-600' : ''}`}
                            >
                              {isAdded ? (
                                'Tillagd!'
                              ) : (
                                <>
                                  <ShoppingCart className="w-3 h-3 mr-1" />
                                  {language === 'sv' ? 'Köp' : 'Add'}
                                </>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeItem(product.node.id)}
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="p-4 border-t border-border space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => clearWishlist()}
                  className="w-full text-muted-foreground"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {language === 'sv' ? 'Rensa önskelista' : 'Clear wishlist'}
                </Button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default WishlistDrawer;
