import { useState } from 'react';
import { motion } from 'framer-motion';
import { ShoppingCart, Check, Flame, Package } from 'lucide-react';
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

const FALLBACK_IMAGE = '/placeholder.svg';

const StockIndicator = ({ stock, allowOverselling, lang }: { stock: number; allowOverselling: boolean; lang: 'sv' | 'en' }) => {
  if (allowOverselling || stock > 10) {
    return (
      <span className="text-[11px] text-accent font-medium">
        {lang === 'sv' ? 'I lager' : 'In stock'}
      </span>
    );
  }
  if (stock > 0) {
    return (
      <span className="text-[11px] text-warning font-medium">
        {lang === 'sv' ? `Bara ${stock} kvar` : `Only ${stock} left`}
      </span>
    );
  }
  return (
    <span className="text-[11px] text-destructive font-medium">
      {lang === 'sv' ? 'Slutsåld' : 'Sold out'}
    </span>
  );
};

const DbProductCard = ({ product, index, compact = false }: DbProductCardProps) => {
  const { language, t } = useLanguage();
  const lang = getContentLang(language);
  const { items, addItem } = useCartStore();
  const [isAdded, setIsAdded] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [imgError, setImgError] = useState(false);

  const title = lang === 'sv' ? product.title_sv : (product.title_en || product.title_sv);
  const description = lang === 'sv' ? product.description_sv : (product.description_en || product.description_sv);
  const imageUrl = product.image_urls?.[0];
  const availableStock = product.stock - (product.reserved_stock || 0);
  const isAvailable = availableStock > 0 || product.allow_overselling;
  const handle = product.handle || product.id;

  const cartItem = items.find(item => (item.product as any).dbId === product.id);
  const quantityInCart = cartItem?.quantity || 0;

  const formatPrice = (amount: number) =>
    new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', minimumFractionDigits: 0 }).format(amount);

  const discountPercent = product.original_price && product.original_price > product.price
    ? Math.round((1 - product.price / product.original_price) * 100)
    : null;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

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

  const showImage = imageUrl && !imgError;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.04, duration: 0.4 }}
      className="group relative"
    >
      <Link to={`/product/${handle}`}>
        <div className="bg-card border border-border/60 rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-[var(--shadow-elevated)] hover:-translate-y-1 h-full flex flex-col">
          {/* Image */}
          <div className="relative aspect-[4/5] overflow-hidden bg-secondary/30">
            {showImage ? (
              <img
                src={imageUrl}
                alt={title}
                loading="lazy"
                onError={() => setImgError(true)}
                className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-secondary/50">
                <Package className="w-10 h-10 text-muted-foreground/20" />
              </div>
            )}

            {/* Sold out overlay */}
            {!isAvailable && (
              <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                <span className="text-sm font-semibold text-foreground">
                  {lang === 'sv' ? 'Slutsåld' : 'Sold out'}
                </span>
              </div>
            )}

            {/* Badges */}
            {product.badge === 'bestseller' && (
              <div className="absolute top-3 right-3 z-10">
                <Badge className="bg-foreground text-background text-[10px] font-semibold px-2 py-0.5 rounded-full">
                  <Flame className="w-3 h-3 mr-1" />
                  Popular
                </Badge>
              </div>
            )}
            {product.badge === 'new' && (
              <div className="absolute top-3 right-3 z-10">
                <Badge className="bg-accent text-accent-foreground text-[10px] font-semibold px-2 py-0.5 rounded-full">
                  {t('product.new') || 'Ny'}
                </Badge>
              </div>
            )}
            {product.badge === 'sale' && discountPercent && (
              <div className="absolute top-3 right-3 z-10">
                <Badge variant="destructive" className="text-[10px] font-semibold px-2 py-0.5 rounded-full">
                  -{discountPercent}%
                </Badge>
              </div>
            )}

            {/* Wishlist */}
            <div className="absolute top-3 left-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <WishlistButton
                product={{ node: { id: product.id, handle, title, images: { edges: [] }, variants: { edges: [] }, priceRange: { minVariantPrice: { amount: product.price.toString(), currencyCode: 'SEK' } }, tags: [], productType: '', description: '' } } as any}
                size="sm"
                className="bg-background/80 backdrop-blur-sm hover:bg-background"
              />
            </div>

            {/* Cart badge */}
            {quantityInCart > 0 && (
              <div className="absolute bottom-3 left-3 z-10">
                <Badge className="bg-accent text-accent-foreground text-[10px] px-2 py-0.5 rounded-full">
                  {quantityInCart} {t('product.incart')}
                </Badge>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="p-4">
            <h3 className="font-semibold text-sm mb-1.5 line-clamp-2 group-hover:text-accent transition-colors duration-200">
              {title}
            </h3>

            {/* Stock status */}
            <div className="mb-2">
              <StockIndicator stock={availableStock} allowOverselling={product.allow_overselling} lang={lang} />
            </div>

            {/* Price */}
            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-lg font-bold text-foreground">{formatPrice(product.price)}</span>
              {product.original_price && product.original_price > product.price && (
                <span className="text-xs text-muted-foreground line-through">{formatPrice(product.original_price)}</span>
              )}
            </div>

            {/* Add to cart */}
            <div className="flex items-center gap-1.5" onClick={(e) => e.preventDefault()}>
              <QuantitySelector quantity={quantity} onChange={setQuantity} size="xs" />
              <Button
                size="sm"
                onClick={handleAddToCart}
                disabled={!isAvailable}
                className={`flex-1 h-8 text-xs rounded-lg transition-all ${isAdded ? 'bg-accent hover:bg-accent text-accent-foreground' : ''}`}
              >
                {!isAvailable
                  ? t('product.soldout')
                  : isAdded
                    ? <Check className="w-3.5 h-3.5" />
                    : <><ShoppingCart className="w-3.5 h-3.5 mr-1" />{t('product.buy')}</>
                }
              </Button>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
};

export default DbProductCard;
