import { useState } from 'react';
import { motion } from 'framer-motion';
import { ShoppingCart, Check, Flame, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DbProduct } from '@/lib/products';
import { useCartStore } from '@/stores/cartStore';
import { Link } from 'react-router-dom';
import QuantitySelector from './QuantitySelector';
import WishlistButton from '@/components/wishlist/WishlistButton';
import { useLanguage, getContentLang } from '@/context/LanguageContext';

interface DbProductCardProps {
  product: DbProduct;
  index: number;
  compact?: boolean;
}

const DbProductCard = ({ product, index, compact = false }: DbProductCardProps) => {
  const { language } = useLanguage();
  const lang = getContentLang(language);
  const { items, addItem } = useCartStore();
  const [isAdded, setIsAdded] = useState(false);
  const [quantity, setQuantity] = useState(1);

  const title = lang === 'sv' ? product.title_sv : (product.title_en || product.title_sv);
  const description = lang === 'sv' ? product.description_sv : (product.description_en || product.description_sv);
  const imageUrl = product.image_urls?.[0];
  const isAvailable = product.stock > 0 || product.allow_overselling;
  const handle = product.handle || product.id;

  // Check cart quantity
  const cartItem = items.find(item => (item.product as any).dbId === product.id);
  const quantityInCart = cartItem?.quantity || 0;

  const formatPrice = (amount: number) =>
    new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', minimumFractionDigits: 0 }).format(amount);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Build a ShopifyProduct-compatible shape for cart store
    const cartProduct = {
      dbId: product.id,
      node: {
        id: product.id,
        title,
        handle,
        description: description || '',
        productType: product.category || '',
        tags: product.tags || [],
        priceRange: {
          minVariantPrice: { amount: product.price.toString(), currencyCode: 'SEK' },
        },
        images: { edges: imageUrl ? [{ node: { url: imageUrl, altText: title } }] : [] },
        variants: {
          edges: [{
            node: {
              id: product.id + '-variant',
              title: 'Default',
              availableForSale: isAvailable,
              price: { amount: product.price.toString(), currencyCode: 'SEK' },
              selectedOptions: [],
            }
          }]
        },
      }
    } as any;

    addItem({
      product: cartProduct,
      variantId: product.id + '-variant',
      variantTitle: 'Default',
      price: { amount: product.price.toString(), currencyCode: 'SEK' },
      quantity,
      selectedOptions: [],
    });

    setIsAdded(true);
    setQuantity(1);
    setTimeout(() => setIsAdded(false), 1500);
  };

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: index * 0.05, duration: 0.4 }}
        whileHover={{ y: -8, transition: { duration: 0.3 } }}
        whileTap={{ scale: 0.98 }}
        className="group relative touch-manipulation"
      >
        <Link to={`/product/${handle}`}>
          <div className="glass-card p-3 h-full flex flex-col transition-all duration-300 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/10 glow-effect">
            {/* Badge */}
            {product.badge === 'bestseller' && (
              <div className="absolute top-2 right-2 z-20 w-8 h-8 rounded-full bg-orange-500/90 backdrop-blur-sm flex items-center justify-center shadow-lg">
                <Flame className="w-4 h-4 text-white" />
              </div>
            )}
            {product.badge === 'new' && (
              <div className="absolute top-2 right-2 z-20">
                <Badge className="bg-primary text-primary-foreground text-xs">Ny</Badge>
              </div>
            )}
            {product.badge === 'sale' && (
              <div className="absolute top-2 right-2 z-20">
                <Badge variant="destructive" className="text-xs">REA</Badge>
              </div>
            )}

            {/* Wishlist */}
            <div className="absolute top-2 left-2 z-10">
              <WishlistButton
                product={{ node: { id: product.id, handle, title, images: { edges: [] }, variants: { edges: [] }, priceRange: { minVariantPrice: { amount: product.price.toString(), currencyCode: 'SEK' } }, tags: [], productType: '', description: '' } } as any}
                size="sm"
                className="bg-background/50 backdrop-blur-sm hover:bg-background/80"
              />
            </div>

            {/* Cart badge */}
            {quantityInCart > 0 && (
              <div className="absolute bottom-2 left-2 z-10">
                <Badge className="bg-primary text-primary-foreground text-xs px-2 py-0.5">
                  {quantityInCart} i korgen
                </Badge>
              </div>
            )}

            {/* Image */}
            <div className="relative aspect-square mb-3 rounded-lg overflow-hidden bg-secondary/50">
              {imageUrl ? (
                <motion.img
                  src={imageUrl}
                  alt={title}
                  loading="lazy"
                  className="w-full h-full object-cover"
                  whileHover={{ scale: 1.1 }}
                  transition={{ duration: 0.5 }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs text-center p-2">
                  {title}
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col">
              <h3 className="font-display font-semibold text-sm mb-1 group-hover:text-primary transition-colors line-clamp-2">
                {title}
              </h3>

              {/* Price */}
              <div className="mt-auto flex items-center gap-2 pt-2">
                <span className="text-base font-bold text-primary">{formatPrice(product.price)}</span>
                {product.original_price && product.original_price > product.price && (
                  <span className="text-xs text-muted-foreground line-through">{formatPrice(product.original_price)}</span>
                )}
              </div>

              {/* Add to cart */}
              <div className="flex items-center gap-1.5 mt-2" onClick={(e) => e.preventDefault()}>
                <QuantitySelector quantity={quantity} onChange={setQuantity} size="xs" />
                <Button
                  size="sm"
                  onClick={handleAddToCart}
                  disabled={!isAvailable}
                  className={`flex-1 h-7 text-xs transition-all ${isAdded ? 'bg-green-600 hover:bg-green-600' : ''}`}
                >
                  {!isAvailable ? 'Slut' : isAdded ? <Check className="w-3 h-3" /> : <><ShoppingCart className="w-3 h-3 mr-1" />Köp</>}
                </Button>
              </div>
            </div>
          </div>
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1, duration: 0.5 }}
      whileHover={{ y: -10, transition: { duration: 0.3 } }}
      className="group relative"
    >
      <Link to={`/product/${handle}`}>
        <div className="glass-card p-4 h-full flex flex-col hover:border-primary/30 hover:shadow-2xl hover:shadow-primary/15 glow-effect">
          {/* Image */}
          <div className="relative aspect-square mb-4 rounded-lg overflow-hidden bg-secondary/50">
            {imageUrl ? (
              <motion.img src={imageUrl} alt={title} loading="lazy" className="w-full h-full object-cover" whileHover={{ scale: 1.1 }} transition={{ duration: 0.5 }} />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">{title}</div>
            )}
          </div>
          <div className="flex-1 flex flex-col">
            <h3 className="font-display font-semibold text-lg mb-2 group-hover:text-primary transition-colors">{title}</h3>
            {description && <p className="text-muted-foreground text-sm mb-4 line-clamp-2">{description}</p>}
            <div className="mt-auto space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-primary">{formatPrice(product.price)}</span>
                {product.original_price && product.original_price > product.price && (
                  <span className="text-sm text-muted-foreground line-through">{formatPrice(product.original_price)}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <QuantitySelector quantity={quantity} onChange={setQuantity} size="sm" />
                <Button
                  onClick={handleAddToCart}
                  disabled={!isAvailable}
                  className={`flex-1 transition-all ${isAdded ? 'bg-green-600 hover:bg-green-600' : ''}`}
                >
                  {!isAvailable ? 'Slut i lager' : isAdded ? <><Check className="w-4 h-4 mr-1" />Tillagd</> : <><ShoppingCart className="w-4 h-4 mr-1" />Köp</>}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
};

export default DbProductCard;
