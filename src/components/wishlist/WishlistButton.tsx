import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWishlistStore } from '@/stores/wishlistStore';
import { ShopifyProduct } from '@/lib/shopify';
import { cn } from '@/lib/utils';

interface WishlistButtonProps {
  product: ShopifyProduct;
  size?: 'sm' | 'default' | 'icon';
  className?: string;
  showLabel?: boolean;
}

const WishlistButton = ({ product, size = 'icon', className, showLabel = false }: WishlistButtonProps) => {
  const { addItem, removeItem, isInWishlist } = useWishlistStore();
  const isWishlisted = isInWishlist(product.node.id);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isWishlisted) {
      removeItem(product.node.id);
    } else {
      addItem(product);
    }
  };

  return (
    <Button
      variant="ghost"
      size={size}
      onClick={handleClick}
      className={cn(
        'transition-all hover:scale-110',
        isWishlisted && 'text-red-500 hover:text-red-600',
        className
      )}
      title={isWishlisted ? 'Ta bort från önskelistan' : 'Lägg till i önskelistan'}
    >
      <Heart 
        className={cn(
          'w-5 h-5 transition-all',
          isWishlisted && 'fill-current'
        )} 
      />
      {showLabel && (
        <span className="ml-2">
          {isWishlisted ? 'Sparad' : 'Spara'}
        </span>
      )}
    </Button>
  );
};

export default WishlistButton;
