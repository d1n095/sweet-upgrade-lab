import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { trackProductView } from '@/utils/analyticsTracker';
import { motion } from 'framer-motion';
import { ShoppingCart, Check, Loader2, Minus, Plus, Shield, RotateCcw, Truck, Share2, Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { fetchDbProductByHandle, DbProduct } from '@/lib/products';
import { useLanguage } from '@/context/LanguageContext';
import { useCartStore } from '@/stores/cartStore';
import { useTranslatedProduct } from '@/hooks/useTranslatedProduct';
import PaymentMethods from '@/components/trust/PaymentMethods';
import ReviewList from '@/components/reviews/ReviewList';
import ReviewForm from '@/components/reviews/ReviewForm';
import ProductIngredients from '@/components/product/ProductIngredients';
import ProductCertifications from '@/components/product/ProductCertifications';
import ZoomableImage from '@/components/product/ZoomableImage';
import MobileBuyBar from '@/components/product/MobileBuyBar';
import SEOHead from '@/components/seo/SEOHead';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

// Auto-generate SEO description from product data
function generateAutoSeoDescription(product: DbProduct): string {
  const parts: string[] = [];
  if (product.description_sv) parts.push(product.description_sv.substring(0, 80));
  if (product.ingredients_sv) {
    const ingList = product.ingredients_sv.split(',').slice(0, 3).map(s => s.trim()).join(', ');
    parts.push(`Innehåller ${ingList}`);
  }
  if (product.certifications?.length) parts.push(product.certifications.join(', '));
  const result = parts.join('. ').substring(0, 155);
  return result || `Köp ${product.title_sv} hos 4ThePeople — noggrant utvalt, giftfritt och hållbart.`;
}

// Auto-generate SEO keywords from product data
function generateAutoSeoKeywords(product: DbProduct): string {
  const keywords: string[] = [product.title_sv];
  if (product.category) keywords.push(product.category);
  if (product.tags?.length) keywords.push(...product.tags.slice(0, 5));
  if (product.vendor) keywords.push(product.vendor);
  if (product.certifications?.length) keywords.push(...product.certifications.slice(0, 3));
  if (product.ingredients_sv) {
    keywords.push(...product.ingredients_sv.split(',').slice(0, 3).map(s => s.trim()));
  }
  keywords.push('4thepeople', 'köp online');
  return [...new Set(keywords)].join(', ');
}

const ProductDetail = () => {
  const { handle } = useParams<{ handle: string }>();
  const { t, language } = useLanguage();
  const lang = (language === 'no' || language === 'da') ? 'sv' : language;
  const { addItem } = useCartStore();
  const [product, setProduct] = useState<DbProduct | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [isAdded, setIsAdded] = useState(false);

  // AI translation hook
  const translated = useTranslatedProduct(product);

  useEffect(() => {
    const load = async () => {
      if (!handle) return;
      try {
        setIsLoading(true);
        const data = await fetchDbProductByHandle(handle);
        setProduct(data);
      } catch (err) {
        console.error('Failed to load product:', err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [handle]);

  useEffect(() => {
    if (product) {
      trackProductView(product.id, product.title_sv, product.price);
    }
  }, [product]);

  const formatPrice = (amount: number) =>
    new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', minimumFractionDigits: 0 }).format(amount);

  const handleAddToCart = () => {
    if (!product) return;
    const cartTitle = translated.title || product.title_sv;
    const cartDescription = translated.description || product.description_sv;
    const imageUrl = product.image_urls?.[0];
    const pHandle = product.handle || product.id;

    const cartProduct = {
      dbId: product.id,
      node: {
        id: product.id,
        title: cartTitle,
        handle: pHandle,
        description: cartDescription || '',
        productType: product.category || '',
        tags: product.tags || [],
        priceRange: { minVariantPrice: { amount: product.price.toString(), currencyCode: 'SEK' } },
        images: { edges: imageUrl ? [{ node: { url: imageUrl, altText: cartTitle } }] : [] },
        variants: {
          edges: [{
            node: {
              id: product.id + '-variant',
              title: 'Default',
              availableForSale: (product.stock - (product.reserved_stock || 0)) > 0 || product.allow_overselling,
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

  const handleShare = async () => {
    const url = window.location.href;
    const shareTitle = document.title;
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: shareTitle, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success(lang === 'sv' ? 'Länk kopierad!' : 'Link copied!');
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        try {
          await navigator.clipboard.writeText(url);
          toast.success(lang === 'sv' ? 'Länk kopierad!' : 'Link copied!');
        } catch {
          toast.error(lang === 'sv' ? 'Kunde inte dela' : 'Could not share');
        }
      }
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
        </div>
        <Footer />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-32 text-center">
          <h1 className="text-2xl font-bold mb-4">{t('product.notfound')}</h1>
          <Link to="/produkter">
            <Button>{t('product.back')}</Button>
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const title = translated.title || product.title_sv;
  const description = translated.description || product.description_sv;
  const images = product.image_urls || [];
  const imageUrl = images[selectedImage] || null;
  const availableStock = product.stock - (product.reserved_stock || 0);
  const isOutOfStock = !product.allow_overselling && availableStock <= 0;
  const hasDiscount = product.original_price && product.original_price > product.price;
  const discountPercent = hasDiscount
    ? Math.round((1 - product.price / product.original_price!) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={product.meta_title || `${product.title_sv} — Köp online | 4thepeople`}
        description={
          product.meta_description ||
          generateAutoSeoDescription(product)
        }
        keywords={
          product.meta_keywords ||
          generateAutoSeoKeywords(product)
        }
        canonical={`/product/${handle}`}
        ogType="product"
        ogImage={images[0]}
        schemaType="Product"
        schemaData={{
          name: product.title_sv,
          description: product.description_sv || '',
          image: images[0] || '',
          offers: {
            '@type': 'Offer',
            price: product.price,
            priceCurrency: 'SEK',
            availability: isOutOfStock ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
          },
        }}
      />
      <Header />
      <main className="pt-24 pb-28 md:pb-20">
        <div className="container mx-auto px-4">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-xs mb-6">
            <Link to="/" className="text-muted-foreground/70 hover:text-foreground hover:underline transition-colors">
              {lang === 'sv' ? 'Hem' : 'Home'}
            </Link>
            <span className="text-muted-foreground/40">/</span>
            <Link to="/produkter" className="text-muted-foreground/70 hover:text-foreground hover:underline transition-colors">
              {lang === 'sv' ? 'Produkter' : 'Products'}
            </Link>
            <span className="text-muted-foreground/40">/</span>
            <span className="text-foreground font-semibold truncate max-w-[200px] capitalize">{title}</span>
          </nav>

          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16">
            {/* Image gallery */}
            <div className="flex flex-col gap-3">
              {imageUrl ? (
                <ZoomableImage src={imageUrl} alt={title}>
                  {product.badge && (
                    <div className="absolute top-3 left-3 z-10 pointer-events-none">
                      <Badge
                        variant={product.badge === 'sale' ? 'destructive' : 'default'}
                        className="text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wide"
                      >
                        {product.badge === 'new' ? (lang === 'sv' ? 'Nyhet' : 'New') :
                         product.badge === 'bestseller' ? (lang === 'sv' ? 'Bästsäljare' : 'Bestseller') :
                         (lang === 'sv' ? 'Rea' : 'Sale')}
                      </Badge>
                    </div>
                  )}
                  {hasDiscount && (
                    <div className="absolute top-3 right-3 z-10 pointer-events-none">
                      <span className="bg-destructive text-destructive-foreground text-xs font-bold px-2.5 py-1 rounded-full">
                        -{discountPercent}%
                      </span>
                    </div>
                  )}
                </ZoomableImage>
              ) : (
                <div className="relative aspect-square rounded-2xl overflow-hidden bg-secondary/30 border border-border">
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                    {t('product.noimage')}
                  </div>
                </div>
              )}
              {images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {images.map((url, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedImage(i)}
                      className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                        selectedImage === i ? 'border-foreground ring-1 ring-foreground/20' : 'border-border opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img src={url} alt="" loading="lazy" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Product info */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="flex flex-col"
            >
              {product.vendor && (
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2">{product.vendor}</p>
              )}
              {translated.isTranslating && (
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground animate-pulse mb-2">
                  <Languages className="w-3.5 h-3.5" />
                  {lang === 'sv' ? 'Laddar...' : 'Translating...'}
                </span>
              )}
              <h1 className="font-display text-2xl md:text-3xl font-bold mb-4 leading-tight">{title}</h1>

              {/* Price */}
              <div className="flex items-baseline gap-3 mb-4">
                <span className="text-3xl font-bold">{formatPrice(product.price)}</span>
                {hasDiscount && (
                  <span className="text-lg text-muted-foreground line-through">{formatPrice(product.original_price!)}</span>
                )}
              </div>

              {/* Stock status */}
              <div className="mb-5">
                {isOutOfStock ? (
                  <span className="inline-flex items-center gap-1.5 text-sm text-destructive font-medium bg-destructive/10 px-3 py-1 rounded-full">{t('product.outofstockwarning')}</span>
                ) : availableStock <= 5 ? (
                  <span className="inline-flex items-center gap-1.5 text-sm text-warning font-medium bg-warning/10 px-3 py-1 rounded-full">
                    {t('product.lowstock').replace('{count}', String(availableStock))}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-sm text-accent font-medium bg-accent/10 px-3 py-1 rounded-full">{t('product.instock')}</span>
                )}
              </div>

              {description && (
                <p className="text-muted-foreground leading-relaxed mb-6">{description}</p>
              )}

              {/* Quantity + Add to cart (desktop) */}
              <div className="hidden md:flex items-center gap-3 mb-6">
                <div className="flex items-center border border-border rounded-lg">
                  <Button variant="ghost" size="icon" className="h-11 w-11 rounded-r-none" onClick={() => setQuantity(Math.max(1, quantity - 1))}>
                    <Minus className="w-4 h-4" />
                  </Button>
                  <span className="w-12 text-center font-medium text-lg select-none">{quantity}</span>
                  <Button variant="ghost" size="icon" className="h-11 w-11 rounded-l-none" onClick={() => setQuantity(quantity + 1)}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <Button
                  size="lg"
                  className={`flex-1 h-11 text-sm font-semibold transition-all ${isAdded ? 'bg-accent hover:bg-accent text-accent-foreground' : ''}`}
                  onClick={handleAddToCart}
                  disabled={isOutOfStock}
                >
                  {isOutOfStock ? (
                    t('product.outofstock')
                  ) : isAdded ? (
                    <><Check className="w-4 h-4 mr-2" />{t('product.added')}</>
                  ) : (
                    <><ShoppingCart className="w-4 h-4 mr-2" />{t('product.addtocart')}</>
                  )}
                </Button>
                <Button variant="outline" size="icon" className="h-11 w-11 shrink-0" onClick={handleShare}>
                  <Share2 className="w-4 h-4" />
                </Button>
              </div>

              {/* Trust badges */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                {[
                  { icon: Shield, label: t('product.securepayment') },
                  { icon: RotateCcw, label: t('product.returns') },
                  { icon: Truck, label: t('product.fastdelivery') },
                ].map(({ icon: Icon, label }, i) => (
                  <div key={i} className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-secondary/40 border border-border/50 text-center">
                    <Icon className="w-4 h-4 text-accent" />
                    <span className="text-xs text-muted-foreground leading-tight">{label}</span>
                  </div>
                ))}
              </div>

              <PaymentMethods />
            </motion.div>
          </div>

          {/* Ingredients & Certifications */}
          {(product.ingredients_sv || (product.certifications && product.certifications.length > 0)) && (
            <div className="mt-16 grid md:grid-cols-2 gap-6">
              <ProductIngredients
                ingredientsSv={product.ingredients_sv}
                translatedIngredients={translated.ingredients || undefined}
              />
              <ProductCertifications certifications={product.certifications} />
            </div>
          )}

          {/* Reviews */}
          <div className="mt-16 pt-12 border-t border-border">
            <h2 className="font-display text-2xl font-semibold mb-8 text-center">
              {t('product.reviews')}
            </h2>
            <div className="grid lg:grid-cols-2 gap-10">
              <div className="space-y-6">
                <ReviewList productHandle={handle} limit={5} />
              </div>
              <ReviewForm
                productId={product.id}
                productHandle={handle || ''}
                productTitle={title}
              />
            </div>
          </div>
        </div>
      </main>

      <MobileBuyBar
        quantity={quantity}
        setQuantity={setQuantity}
        isAdded={isAdded}
        isOutOfStock={isOutOfStock}
        price={product.price}
        onAddToCart={handleAddToCart}
      />

      <Footer />
    </div>
  );
};

export default ProductDetail;