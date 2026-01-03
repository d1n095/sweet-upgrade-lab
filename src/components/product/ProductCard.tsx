import { motion } from 'framer-motion';
import { ShoppingCart, Check, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Product } from '@/types/product';
import { useCart } from '@/context/CartContext';
import { useState } from 'react';

interface ProductCardProps {
  product: Product;
  index: number;
}

const ProductCard = ({ product, index }: ProductCardProps) => {
  const { addToCart } = useCart();
  const [isAdded, setIsAdded] = useState(false);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const handleAddToCart = () => {
    addToCart(product);
    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 1500);
  };

  const badgeVariants = {
    new: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    bestseller: 'bg-primary/20 text-primary border-primary/30',
    sale: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1, duration: 0.5 }}
      className="group relative"
    >
      <div className="glass-card p-4 h-full flex flex-col transition-all duration-300 hover:border-primary/30 glow-effect">
        {/* Badge */}
        {product.badge && (
          <Badge className={`absolute top-6 left-6 z-10 ${badgeVariants[product.badge]}`}>
            {product.badge === 'new' && 'Ny'}
            {product.badge === 'bestseller' && 'Bästsäljare'}
            {product.badge === 'sale' && 'Rea'}
          </Badge>
        )}

        {/* Image */}
        <div className="relative aspect-square mb-4 rounded-lg overflow-hidden bg-secondary/50">
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          
          {/* Power indicator */}
          <div className="absolute bottom-3 right-3 px-2 py-1 rounded-md bg-background/80 backdrop-blur-sm flex items-center gap-1 text-xs font-medium">
            <Zap className="w-3 h-3 text-primary" />
            {product.power}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col">
          <h3 className="font-display font-semibold text-lg mb-2 group-hover:text-primary transition-colors">
            {product.name}
          </h3>
          <p className="text-muted-foreground text-sm mb-4 line-clamp-2">
            {product.description}
          </p>

          {/* Features */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {product.features.slice(0, 3).map((feature) => (
              <span
                key={feature}
                className="text-xs px-2 py-1 rounded-full bg-secondary text-muted-foreground"
              >
                {feature}
              </span>
            ))}
          </div>

          {/* Price and CTA */}
          <div className="mt-auto flex items-end justify-between gap-4">
            <div>
              {product.originalPrice && (
                <span className="text-sm text-muted-foreground line-through block">
                  {formatPrice(product.originalPrice)}
                </span>
              )}
              <span className="text-xl font-bold text-primary">
                {formatPrice(product.price)}
              </span>
            </div>

            <Button
              onClick={handleAddToCart}
              disabled={!product.inStock}
              className={`transition-all ${isAdded ? 'bg-green-600 hover:bg-green-600' : ''}`}
            >
              {!product.inStock ? (
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
    </motion.div>
  );
};

export default ProductCard;
