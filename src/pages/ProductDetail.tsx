import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ShoppingCart, Check, Loader2, Minus, Plus, Shield, RotateCcw, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { fetchDbProductByHandle, DbProduct } from '@/lib/products';
import { useLanguage } from '@/context/LanguageContext';
import PaymentMethods from '@/components/trust/PaymentMethods';
import ReviewList from '@/components/reviews/ReviewList';
import ReviewForm from '@/components/reviews/ReviewForm';
import { Badge } from '@/components/ui/badge';

const ProductDetail = () => {
  const { handle } = useParams<{ handle: string }>();
  const { t, contentLang } = useLanguage();
  const lang = contentLang;
  const [product, setProduct] = useState<DbProduct | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [isAdded, setIsAdded] = useState(false);

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

  const formatPrice = (amount: number) =>
    new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', minimumFractionDigits: 0 }).format(amount);

  const handleAddToCart = () => {
    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 1500);
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
          <Link to="/shop">
            <Button>{t('product.back')}</Button>
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const title = (lang === 'sv' ? product.title_sv : product.title_en) || product.title_sv;
  const description = (lang === 'sv' ? product.description_sv : product.description_en) || product.description_sv;
  const images = product.image_urls || [];
  const imageUrl = images[selectedImage] || null;
  const isOutOfStock = !product.allow_overselling && product.stock <= 0;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-24 pb-20">
        <div className="container mx-auto px-4">
          <Link to="/shop" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            {t('product.back')}
          </Link>

          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20">
            {/* Images */}
            <div className="flex flex-col gap-4">
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                className="relative aspect-square rounded-2xl overflow-hidden bg-secondary/50"
              >
                {imageUrl ? (
                  <img src={imageUrl} alt={title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                    {t('product.noimage')}
                  </div>
                )}
                {product.badge && (
                  <div className="absolute top-3 left-3">
                    <Badge variant={product.badge === 'sale' ? 'destructive' : 'default'} className="uppercase text-xs font-bold">
                      {product.badge === 'new' ? (lang === 'sv' ? 'Nyhet' : 'New') :
                       product.badge === 'bestseller' ? (lang === 'sv' ? 'Bästsäljare' : 'Bestseller') :
                       (lang === 'sv' ? 'Rea' : 'Sale')}
                    </Badge>
                  </div>
                )}
              </motion.div>
              {images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto">
                  {images.map((url, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedImage(i)}
                      className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                        selectedImage === i ? 'border-primary' : 'border-border opacity-60'
                      }`}
                    >
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Details */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex flex-col"
            >
              {product.vendor && (
                <p className="text-sm text-muted-foreground mb-1">{product.vendor}</p>
              )}
              <h1 className="font-display text-3xl md:text-4xl font-bold mb-4">{title}</h1>

              <div className="flex items-center gap-3 mb-6">
                <p className="text-2xl font-bold text-primary">{formatPrice(product.price)}</p>
                {product.original_price && product.original_price > product.price && (
                  <p className="text-lg text-muted-foreground line-through">{formatPrice(product.original_price)}</p>
                )}
              </div>

              <div className="mb-6">
                {isOutOfStock ? (
                  <span className="text-sm text-destructive font-medium">{t('product.outofstockwarning')}</span>
                ) : product.stock <= 5 ? (
                  <span className="text-sm text-yellow-600 dark:text-yellow-400 font-medium">
                    {t('product.lowstock').replace('{count}', String(product.stock))}
                  </span>
                ) : (
                  <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">{t('product.instock')}</span>
                )}
              </div>

              {description && (
                <p className="text-muted-foreground text-lg mb-8 leading-relaxed">{description}</p>
              )}

              <div className="mb-8">
                <label className="block text-sm font-medium mb-2">{t('product.quantity')}</label>
                <div className="flex items-center gap-3">
                  <Button variant="outline" size="icon" onClick={() => setQuantity(Math.max(1, quantity - 1))}>
                    <Minus className="w-4 h-4" />
                  </Button>
                  <span className="w-12 text-center font-medium text-lg">{quantity}</span>
                  <Button variant="outline" size="icon" onClick={() => setQuantity(quantity + 1)}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <Button
                size="lg"
                className={`h-14 text-base font-semibold transition-all ${isAdded ? 'bg-green-600 hover:bg-green-600' : ''}`}
                onClick={handleAddToCart}
                disabled={isOutOfStock}
              >
                {isOutOfStock ? (
                  t('product.outofstock')
                ) : isAdded ? (
                  <><Check className="w-5 h-5 mr-2" />{t('product.added')}</>
                ) : (
                  <><ShoppingCart className="w-5 h-5 mr-2" />{t('product.addtocart')}</>
                )}
              </Button>

              <div className="mt-8 pt-6 border-t border-border space-y-4">
                <div className="grid grid-cols-3 gap-4 text-center text-sm">
                  <div className="flex flex-col items-center gap-2">
                    <Shield className="w-5 h-5 text-primary" />
                    <span className="text-muted-foreground">{t('product.securepayment')}</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <RotateCcw className="w-5 h-5 text-primary" />
                    <span className="text-muted-foreground">{t('product.returns')}</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <Truck className="w-5 h-5 text-primary" />
                    <span className="text-muted-foreground">{t('product.fastdelivery')}</span>
                  </div>
                </div>
                <PaymentMethods />
              </div>
            </motion.div>
          </div>

          <div className="mt-20 pt-16 border-t border-border">
            <h2 className="font-display text-2xl md:text-3xl font-semibold mb-8 text-center">
              {t('product.reviews')}
            </h2>
            <div className="grid lg:grid-cols-2 gap-10">
              <ReviewList productHandle={handle} limit={5} />
              <ReviewForm
                productId={product.id}
                productHandle={handle || ''}
                productTitle={title}
              />
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ProductDetail;
