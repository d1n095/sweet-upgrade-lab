import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Heart, Trash2, ShoppingCart, LogIn } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useWishlistStore, WishlistItem } from '@/stores/wishlistStore';
import { useCartStore, dbVariantId } from '@/stores/cartStore';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import AuthModal from '@/components/auth/AuthModal';

interface WishlistDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const WishlistDrawer = ({ isOpen, onClose }: WishlistDrawerProps) => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const { items, removeItem, clearWishlist } = useWishlistStore();
  const { addItem: addToCart } = useCartStore();
  const [addedItems, setAddedItems] = useState<Set<string>>(new Set());
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const navigate = useNavigate();

  const handleExploreProducts = () => {
    onClose();
    navigate('/produkter');
  };

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
    }).format(price);

  const handleAddToCart = (item: WishlistItem) => {
    const variantId = dbVariantId(item.id);
    addToCart({
      product: {
        dbId: item.id,
        node: {
          id: item.id,
          title: item.title,
          handle: item.handle,
          description: '',
          productType: '',
          tags: [],
          priceRange: { minVariantPrice: { amount: item.price.toString(), currencyCode: 'SEK' } },
          images: { edges: item.imageUrl ? [{ node: { url: item.imageUrl, altText: item.title } }] : [] },
          variants: {
            edges: [{
              node: {
                id: variantId,
                title: 'Default',
                availableForSale: true,
                price: { amount: item.price.toString(), currencyCode: 'SEK' },
                selectedOptions: [],
              },
            }],
          },
        },
      },
      variantId,
      variantTitle: 'Default',
      price: { amount: item.price.toString(), currencyCode: 'SEK' },
      quantity: 1,
      selectedOptions: [],
    });

    setAddedItems(prev => new Set(prev).add(item.id));
    setTimeout(() => {
      setAddedItems(prev => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }, 1500);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
          />

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
                      : 'Save products you like to find them easily later'}
                  </p>
                  <div className="flex flex-col gap-2">
                    <Button onClick={handleExploreProducts} variant="outline">
                      {language === 'sv' ? 'Utforska produkter' : 'Explore products'}
                    </Button>
                    {!user && (
                      <Button
                        onClick={() => { onClose(); setIsAuthOpen(true); }}
                        variant="ghost"
                        size="sm"
                        className="text-primary"
                      >
                        <LogIn className="w-4 h-4 mr-1.5" />
                        {language === 'sv' ? 'Logga in för att spara din lista' : 'Log in to save your list'}
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {items.map((item) => {
                    const isAdded = addedItems.has(item.id);
                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: 50 }}
                        className="glass-card p-3 flex gap-3"
                      >
                        <Link
                          to={`/product/${item.handle}`}
                          onClick={onClose}
                          className="relative w-20 h-20 rounded-lg overflow-hidden bg-secondary/50 flex-shrink-0"
                        >
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                              Ingen bild
                            </div>
                          )}
                        </Link>

                        <div className="flex-1 min-w-0">
                          <Link
                            to={`/product/${item.handle}`}
                            onClick={onClose}
                            className="font-semibold text-sm hover:text-primary transition-colors line-clamp-2"
                          >
                            {item.title}
                          </Link>
                          <p className="text-primary font-bold mt-1">{formatPrice(item.price)}</p>

                          <div className="flex items-center gap-2 mt-2">
                            <Button
                              size="sm"
                              onClick={() => handleAddToCart(item)}
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
                              onClick={() => removeItem(item.id)}
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
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </AnimatePresence>
  );
};

export default WishlistDrawer;
