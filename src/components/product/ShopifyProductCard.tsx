import { motion } from 'framer-motion';
import { ShoppingCart, Check, Crown, Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShopifyProduct } from '@/lib/shopify';
import { useCartStore } from '@/stores/cartStore';
import { useMemberPrices } from '@/hooks/useMemberPrices';
import { useAuth } from '@/hooks/useAuth';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import QuantitySelector from './QuantitySelector';
import LowStockBadge from '@/components/engagement/LowStockBadge';
import WishlistButton from '@/components/wishlist/WishlistButton';
import { useLanguage } from '@/context/LanguageContext';
import { useProductSoldCount } from '@/hooks/useProductSales';

interface ShopifyProductCardProps {
  product: ShopifyProduct;
  index: number;
  compact?: boolean;
  isBestseller?: boolean;
}

const ShopifyProductCard = ({ product, index, compact = false, isBestseller: isBestsellerProp = false }: ShopifyProductCardProps) => {
  const { language } = useLanguage();
  const { items, addItem } = useCartStore();
  const { getMemberPrice, getVolumeDiscount } = useMemberPrices();
  const { isMember } = useAuth();
  const [isAdded, setIsAdded] = useState(false);
  const [quantity, setQuantity] = useState(1);

  const { node } = product;
  
  // Real-time sales tracking
  const { soldCount, status, isBestseller: isBestsellerFromSales } = useProductSoldCount(node.id);
  const showBestseller = isBestsellerProp || isBestsellerFromSales;
  const firstVariant = node.variants.edges[0]?.node;
  const imageUrl = node.images.edges[0]?.node.url;
  const regularPrice = parseFloat(node.priceRange.minVariantPrice.amount);
  const currencyCode = node.priceRange.minVariantPrice.currencyCode;
  
  // Get member price if exists
  const memberPrice = firstVariant ? getMemberPrice(firstVariant.id) : null;
  const displayPrice = (isMember && memberPrice) ? memberPrice : regularPrice;
  const hasDiscount = isMember && memberPrice && memberPrice < regularPrice;

  // Get volume discount for current quantity
  const volumeDiscount = getVolumeDiscount(node.id, quantity);
  const finalPrice = volumeDiscount > 0 
    ? displayPrice * (1 - volumeDiscount / 100) 
    : displayPrice;

  // Check how many of this product are in cart
  const cartItem = items.find(item => item.product.node.id === node.id);
  const quantityInCart = cartItem?.quantity || 0;

  const formatPrice = (amount: number, currency: string) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!firstVariant) return;
    
    const cartItem = {
      product,
      variantId: firstVariant.id,
      variantTitle: firstVariant.title,
      price: {
        amount: finalPrice.toString(),
        currencyCode: currencyCode,
      },
      quantity: quantity,
      selectedOptions: firstVariant.selectedOptions || []
    };
    
    addItem(cartItem);
    setIsAdded(true);
    setQuantity(1);
    setTimeout(() => setIsAdded(false), 1500);
  };

  const isAvailable = firstVariant?.availableForSale ?? true;

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: index * 0.05, duration: 0.4 }}
        whileHover={{ y: -8, transition: { duration: 0.3 } }}
        className="group relative"
      >
        <Link to={`/product/${node.handle}`}>
          <div className="glass-card p-3 h-full flex flex-col transition-all duration-300 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/10 glow-effect">
            {/* Real-time popularity status badge */}
            {status && (
              <div className="absolute top-2 right-2 z-20 bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                {status.status} ({status.count} {language === 'sv' ? 'personer' : 'people'})
              </div>
            )}
            
            {/* Bestseller fire icon - positioned on image */}
            {!status && showBestseller && (
              <div className="absolute top-2 right-2 z-20 w-8 h-8 rounded-full bg-orange-500/90 backdrop-blur-sm flex items-center justify-center shadow-lg">
                <Flame className="w-4 h-4 text-white" />
              </div>
            )}

            {/* Wishlist button */}
            <div className={`absolute top-2 z-10 ${status || showBestseller ? 'right-32' : 'right-2'}`}>
              <WishlistButton product={product} size="sm" className="bg-background/50 backdrop-blur-sm hover:bg-background/80" />
            </div>

            {/* Cart quantity badge */}
            {quantityInCart > 0 && (
              <div className="absolute top-2 left-2 z-10">
                <Badge className="bg-primary text-primary-foreground text-xs px-2 py-0.5">
                  {quantityInCart} i korgen
                </Badge>
              </div>
            )}

            {/* Member price badge */}
            {memberPrice && memberPrice < regularPrice && (
              <div className="absolute top-10 left-2 z-10">
                <Badge className="bg-accent text-accent-foreground text-xs px-2 py-0.5">
                  <Crown className="w-3 h-3 mr-1" />
                  Medlem
                </Badge>
              </div>
            )}

            {/* Image */}
            <div className="relative aspect-square mb-3 rounded-lg overflow-hidden bg-secondary/50">
              {imageUrl ? (
                <motion.img
                  src={imageUrl}
                  alt={node.title}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                  whileHover={{ scale: 1.1 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                  Ingen bild
                </div>
              )}
              {/* Low stock badge on image */}
              <div className="absolute bottom-2 left-2 flex flex-wrap gap-1">
                <LowStockBadge productId={node.id} compact />
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col">
              <h3 className="font-display font-semibold text-sm mb-1 group-hover:text-primary transition-colors line-clamp-2">
                {node.title}
              </h3>

              {/* Price */}
              <div className="mt-auto flex items-center gap-2 pt-2">
                <span className="text-base font-bold text-primary">
                  {formatPrice(finalPrice, currencyCode)}
                </span>
                {hasDiscount && (
                  <span className="text-xs text-muted-foreground line-through">
                    {formatPrice(regularPrice, currencyCode)}
                  </span>
                )}
              </div>

              {/* Volume discount hint */}
              {volumeDiscount > 0 && (
                <p className="text-xs text-accent font-medium mt-1">
                  {volumeDiscount}% rabatt vid {quantity}+ st
                </p>
              )}

              {/* Quantity selector and add to cart */}
              <div className="flex items-center gap-1.5 mt-2" onClick={(e) => e.preventDefault()}>
                <QuantitySelector
                  quantity={quantity}
                  onChange={setQuantity}
                  size="xs"
                />
                <Button
                  size="sm"
                  onClick={handleAddToCart}
                  disabled={!isAvailable}
                  className={`flex-1 h-7 text-xs transition-all ${isAdded ? 'bg-green-600 hover:bg-green-600' : ''}`}
                >
                  {!isAvailable ? (
                    'Slut'
                  ) : isAdded ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    <>
                      <ShoppingCart className="w-3 h-3 mr-1" />
                      Köp
                    </>
                  )}
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
      <Link to={`/product/${node.handle}`}>
        <div className="glass-card p-4 h-full flex flex-col transition-all duration-300 hover:border-primary/30 hover:shadow-2xl hover:shadow-primary/15 glow-effect">
          {/* Real-time popularity status badge */}
          {status && (
            <div className="absolute top-3 right-3 z-20 bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
              {status.status} ({status.count} {language === 'sv' ? 'personer' : 'people'})
            </div>
          )}
          
          {/* Bestseller fire icon - positioned on image */}
          {!status && showBestseller && (
            <div className="absolute top-3 right-3 z-20 w-10 h-10 rounded-full bg-orange-500/90 backdrop-blur-sm flex items-center justify-center shadow-lg">
              <Flame className="w-5 h-5 text-white" />
            </div>
          )}

          {/* Wishlist button */}
          <div className={`absolute top-3 z-10 ${status || showBestseller ? 'right-36' : 'right-3'}`}>
            <WishlistButton product={product} className="bg-background/50 backdrop-blur-sm hover:bg-background/80" />
          </div>

          {/* Cart quantity badge */}
          {quantityInCart > 0 && (
            <div className="absolute top-3 left-3 z-10">
              <Badge className="bg-primary text-primary-foreground px-2.5 py-1">
                {quantityInCart} i korgen
              </Badge>
            </div>
          )}

          {/* Member price badge */}
          {memberPrice && memberPrice < regularPrice && (
            <div className="absolute top-14 left-3 z-10">
              <Badge className="bg-accent text-accent-foreground px-2.5 py-1">
                <Crown className="w-3 h-3 mr-1" />
                Medlemspris
              </Badge>
            </div>
          )}

          {/* Image */}
          <div className="relative aspect-square mb-4 rounded-lg overflow-hidden bg-secondary/50">
            {imageUrl ? (
              <motion.img
                src={imageUrl}
                alt={node.title}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover"
                whileHover={{ scale: 1.1 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                Ingen bild
              </div>
            )}
            {/* Low stock badge on image */}
            <div className="absolute bottom-2 left-2 flex flex-wrap gap-1.5">
              <LowStockBadge productId={node.id} compact />
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 flex flex-col">
            <h3 className="font-display font-semibold text-lg mb-2 group-hover:text-primary transition-colors">
              {node.title}
            </h3>
            <p className="text-muted-foreground text-sm mb-4 line-clamp-2">
              {node.description || 'Ingen beskrivning tillgänglig'}
            </p>

            {/* Price section */}
            <div className="mt-auto space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-primary">
                  {formatPrice(finalPrice, currencyCode)}
                </span>
                {hasDiscount && (
                  <span className="text-sm text-muted-foreground line-through">
                    {formatPrice(regularPrice, currencyCode)}
                  </span>
                )}
              </div>

              {/* Volume discount hint */}
              {volumeDiscount > 0 && (
                <p className="text-xs text-accent font-medium">
                  {volumeDiscount}% rabatt vid {quantity}+ st
                </p>
              )}

              {/* Quantity selector and add to cart */}
              <div className="flex items-center gap-2">
                <QuantitySelector
                  quantity={quantity}
                  onChange={setQuantity}
                  size="sm"
                />
                <Button
                  onClick={handleAddToCart}
                  disabled={!isAvailable}
                  className={`flex-1 transition-all ${isAdded ? 'bg-green-600 hover:bg-green-600' : ''}`}
                >
                  {!isAvailable ? (
                    'Slut i lager'
                  ) : isAdded ? (
                    <>
                      <Check className="w-4 h-4 mr-1" />
                      Tillagd
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="w-4 h-4 mr-1" />
                      Köp
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
};

export default ShopifyProductCard;
