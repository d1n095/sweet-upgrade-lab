import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWishlistStore } from '@/stores/wishlistStore';
import { cn } from '@/lib/utils';

interface WishlistButtonProps {
  productId: string;
  productHandle: string;
  productTitle: string;
  productPrice: number;
  productImageUrl?: string | null;
  size?: 'sm' | 'default' | 'icon';
  className?: string;
  showLabel?: boolean;
}

const WishlistButton = ({
  productId,
  productHandle,
  productTitle,
  productPrice,
  productImageUrl,
  size = 'icon',
  className,
  showLabel = false,
}: WishlistButtonProps) => {
  const { addItem, removeItem, isInWishlist } = useWishlistStore();
  const isWishlisted = isInWishlist(productId);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isWishlisted) {
      removeItem(productId);
    } else {
      addItem({
        id: productId,
        handle: productHandle,
        title: productTitle,
        price: productPrice,
        imageUrl: productImageUrl ?? null,
      });
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
