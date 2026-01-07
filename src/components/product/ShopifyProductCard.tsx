import { motion } from 'framer-motion';
import { ShoppingCart, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ShopifyProduct } from '@/lib/shopify';
import { useCartStore } from '@/stores/cartStore';
import { useState } from 'react';
import { Link } from 'react-router-dom';

interface ShopifyProductCardProps {
  product: ShopifyProduct;
  index: number;
  compact?: boolean;
}

const ShopifyProductCard = ({ product, index, compact = false }: ShopifyProductCardProps) => {
  const addItem = useCartStore(state => state.addItem);
  const [isAdded, setIsAdded] = useState(false);

  const { node } = product;
  const firstVariant = node.variants.edges[0]?.node;
  const imageUrl = node.images.edges[0]?.node.url;
  const price = parseFloat(node.priceRange.minVariantPrice.amount);
  const currencyCode = node.priceRange.minVariantPrice.currencyCode;

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
      price: firstVariant.price,
      quantity: 1,
      selectedOptions: firstVariant.selectedOptions || []
    };
    
    addItem(cartItem);
    setIsAdded(true);
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
        className="group relative"
      >
        <Link to={`/product/${node.handle}`}>
          <div className="glass-card p-3 h-full flex flex-col transition-all duration-300 hover:border-primary/30 glow-effect">
            {/* Image */}
            <div className="relative aspect-square mb-3 rounded-lg overflow-hidden bg-secondary/50">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={node.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                  Ingen bild
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col">
              <h3 className="font-display font-semibold text-sm mb-1 group-hover:text-primary transition-colors line-clamp-2">
                {node.title}
              </h3>

              {/* Price and CTA */}
              <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                <span className="text-base font-bold text-primary">
                  {formatPrice(price, currencyCode)}
                </span>

                <Button
                  size="sm"
                  onClick={handleAddToCart}
                  disabled={!isAvailable}
                  className={`h-8 px-3 text-xs transition-all ${isAdded ? 'bg-green-600 hover:bg-green-600' : ''}`}
                >
                  {!isAvailable ? (
                    'Slut'
                  ) : isAdded ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    <ShoppingCart className="w-3 h-3" />
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
      className="group relative"
    >
      <Link to={`/product/${node.handle}`}>
        <div className="glass-card p-4 h-full flex flex-col transition-all duration-300 hover:border-primary/30 glow-effect">
          {/* Image */}
          <div className="relative aspect-square mb-4 rounded-lg overflow-hidden bg-secondary/50">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={node.title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                Ingen bild
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>

          {/* Content */}
          <div className="flex-1 flex flex-col">
            <h3 className="font-display font-semibold text-lg mb-2 group-hover:text-primary transition-colors">
              {node.title}
            </h3>
            <p className="text-muted-foreground text-sm mb-4 line-clamp-2">
              {node.description || 'Ingen beskrivning tillgänglig'}
            </p>

            {/* Price and CTA */}
            <div className="mt-auto flex items-end justify-between gap-4">
              <span className="text-xl font-bold text-primary">
                {formatPrice(price, currencyCode)}
              </span>

              <Button
                onClick={handleAddToCart}
                disabled={!isAvailable}
                className={`transition-all ${isAdded ? 'bg-green-600 hover:bg-green-600' : ''}`}
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
      </Link>
    </motion.div>
  );
};

export default ShopifyProductCard;
