import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ShoppingCart, Check, Loader2, Minus, Plus, Shield, RotateCcw, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { storefrontApiRequest, ShopifyProduct } from '@/lib/shopify';
import { useCartStore } from '@/stores/cartStore';
import { useRecentlyViewedStore } from '@/stores/recentlyViewedStore';
import SocialProofBadge from '@/components/engagement/SocialProofBadge';
import LowStockBadge from '@/components/engagement/LowStockBadge';
import PaymentMethods from '@/components/trust/PaymentMethods';
import { useLanguage } from '@/context/LanguageContext';

const PRODUCT_QUERY = `
  query GetProduct($handle: String!) {
    productByHandle(handle: $handle) {
      id
      title
      description
      handle
      priceRange {
        minVariantPrice {
          amount
          currencyCode
        }
      }
      images(first: 5) {
        edges {
          node {
            url
            altText
          }
        }
      }
      variants(first: 10) {
        edges {
          node {
            id
            title
            price {
              amount
              currencyCode
            }
            availableForSale
            selectedOptions {
              name
              value
            }
          }
        }
      }
      options {
        name
        values
      }
    }
  }
`;

const ProductDetail = () => {
  const { handle } = useParams<{ handle: string }>();
  const { language } = useLanguage();
  const [product, setProduct] = useState<ShopifyProduct['node'] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isAdded, setIsAdded] = useState(false);
  
  const addItem = useCartStore(state => state.addItem);
  const addToRecentlyViewed = useRecentlyViewedStore(state => state.addProduct);

  useEffect(() => {
    const loadProduct = async () => {
      if (!handle) return;
      
      try {
        setIsLoading(true);
        const data = await storefrontApiRequest(PRODUCT_QUERY, { handle });
        if (data?.data?.productByHandle) {
          const productData = data.data.productByHandle;
          setProduct(productData);
          const firstVariant = productData.variants.edges[0]?.node;
          if (firstVariant) {
            setSelectedVariant(firstVariant.id);
          }
          // Add to recently viewed
          addToRecentlyViewed({ node: productData } as ShopifyProduct);
        }
      } catch (err) {
        console.error('Failed to load product:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadProduct();
  }, [handle, addToRecentlyViewed]);

  const formatPrice = (amount: number, currency: string) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleAddToCart = () => {
    if (!product || !selectedVariant) return;
    
    const variant = product.variants.edges.find(v => v.node.id === selectedVariant)?.node;
    if (!variant) return;

    const cartItem = {
      product: { node: product } as ShopifyProduct,
      variantId: variant.id,
      variantTitle: variant.title,
      price: variant.price,
      quantity,
      selectedOptions: variant.selectedOptions || []
    };
    
    addItem(cartItem);
    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 1500);
  };

  const currentVariant = product?.variants.edges.find(v => v.node.id === selectedVariant)?.node;
  const isAvailable = currentVariant?.availableForSale ?? true;

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
          <h1 className="text-2xl font-bold mb-4">Produkten hittades inte</h1>
          <Link to="/">
            <Button>Tillbaka till startsidan</Button>
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const imageUrl = product.images.edges[0]?.node.url;
  const price = parseFloat(currentVariant?.price.amount || product.priceRange.minVariantPrice.amount);
  const currencyCode = currentVariant?.price.currencyCode || product.priceRange.minVariantPrice.currencyCode;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-24 pb-20">
        <div className="container mx-auto px-4">
          {/* Back button */}
          <Link to="/#products" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Tillbaka till produkter
          </Link>

          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20">
            {/* Image */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              className="relative aspect-square rounded-2xl overflow-hidden bg-secondary/50"
            >
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={product.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  Ingen bild
                </div>
              )}
            </motion.div>

            {/* Details */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex flex-col"
            >
              <h1 className="font-display text-3xl md:text-4xl font-bold mb-4">
                {product.title}
              </h1>
              
              <p className="text-2xl font-bold text-primary mb-4">
                {formatPrice(price, currencyCode)}
              </p>

              {/* Social proof */}
              <div className="mb-6">
                <SocialProofBadge productId={product.id} showViewers showSales />
                <div className="mt-3">
                  <LowStockBadge productId={product.id} />
                </div>
              </div>

              <p className="text-muted-foreground text-lg mb-8 leading-relaxed">
                {product.description || 'Ingen beskrivning tillgänglig'}
              </p>

              {/* Variants */}
              {product.options.length > 0 && product.options[0].name !== 'Title' && (
                <div className="mb-8">
                  {product.options.map((option) => (
                    <div key={option.name} className="mb-4">
                      <label className="block text-sm font-medium mb-2">
                        {option.name}
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {option.values.map((value) => {
                          const variant = product.variants.edges.find(v =>
                            v.node.selectedOptions.some(o => o.name === option.name && o.value === value)
                          );
                          return (
                            <Button
                              key={value}
                              variant={selectedVariant === variant?.node.id ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => variant && setSelectedVariant(variant.node.id)}
                            >
                              {value}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Quantity */}
              <div className="mb-8">
                <label className="block text-sm font-medium mb-2">Antal</label>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  <span className="w-12 text-center font-medium text-lg">{quantity}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setQuantity(quantity + 1)}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Add to cart */}
              <Button
                size="lg"
                className={`h-14 text-base font-semibold transition-all ${isAdded ? 'bg-green-600 hover:bg-green-600' : ''}`}
                onClick={handleAddToCart}
                disabled={!isAvailable}
              >
                {!isAvailable ? (
                  'Slut i lager'
                ) : isAdded ? (
                  <>
                    <Check className="w-5 h-5 mr-2" />
                    Tillagd i kundvagnen
                  </>
                ) : (
                  <>
                    <ShoppingCart className="w-5 h-5 mr-2" />
                    {language === 'sv' ? 'Lägg i kundvagn' : 'Add to cart'}
                  </>
                )}
              </Button>

              {/* Trust elements */}
              <div className="mt-8 pt-6 border-t border-border space-y-4">
                <div className="grid grid-cols-3 gap-4 text-center text-sm">
                  <div className="flex flex-col items-center gap-2">
                    <Shield className="w-5 h-5 text-primary" />
                    <span className="text-muted-foreground">
                      {language === 'sv' ? 'Säker betalning' : 'Secure payment'}
                    </span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <RotateCcw className="w-5 h-5 text-primary" />
                    <span className="text-muted-foreground">
                      {language === 'sv' ? '30 dagars öppet köp' : '30-day returns'}
                    </span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <Truck className="w-5 h-5 text-primary" />
                    <span className="text-muted-foreground">
                      {language === 'sv' ? 'Snabb leverans' : 'Fast delivery'}
                    </span>
                  </div>
                </div>
                <PaymentMethods />
              </div>
            </motion.div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ProductDetail;
