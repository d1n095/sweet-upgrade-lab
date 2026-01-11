import { motion } from 'framer-motion';
import { Clock, ShoppingCart, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useRecentlyViewedStore } from '@/stores/recentlyViewedStore';
import { useCartStore } from '@/stores/cartStore';
import { useLanguage } from '@/context/LanguageContext';
import { useState } from 'react';

const RecentlyViewed = () => {
  const { language } = useLanguage();
  const { products } = useRecentlyViewedStore();
  const { addItem } = useCartStore();
  const [addedIds, setAddedIds] = useState<string[]>([]);

  if (products.length === 0) return null;

  const formatPrice = (amount: string, currency: string) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
    }).format(parseFloat(amount));
  };

  const handleQuickAdd = (product: typeof products[0]) => {
    const variant = product.node.variants.edges[0]?.node;
    if (!variant) return;

    addItem({
      product,
      variantId: variant.id,
      variantTitle: variant.title,
      price: variant.price,
      quantity: 1,
      selectedOptions: variant.selectedOptions || [],
    });

    setAddedIds(prev => [...prev, product.node.id]);
    setTimeout(() => {
      setAddedIds(prev => prev.filter(id => id !== product.node.id));
    }, 1500);
  };

  return (
    <section className="py-12 md:py-16">
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-2 mb-6">
          <Clock className="w-5 h-5 text-primary" />
          <h2 className="font-display text-xl font-semibold">
            {language === 'sv' ? 'Senast visade' : 'Recently viewed'}
          </h2>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
          {products.slice(0, 6).map((product, index) => {
            const variant = product.node.variants.edges[0]?.node;
            const imageUrl = product.node.images.edges[0]?.node.url;
            const isAdded = addedIds.includes(product.node.id);

            return (
              <motion.div
                key={product.node.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex-shrink-0 w-40"
              >
                <Link to={`/product/${product.node.handle}`}>
                  <div className="glass-card p-3 group hover:border-primary/30 transition-all">
                    <div className="aspect-square rounded-lg overflow-hidden bg-secondary/50 mb-2">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={product.node.title}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                          Ingen bild
                        </div>
                      )}
                    </div>
                    <h3 className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                      {product.node.title}
                    </h3>
                    {variant && (
                      <p className="text-primary font-bold text-sm mt-1">
                        {formatPrice(variant.price.amount, variant.price.currencyCode)}
                      </p>
                    )}
                  </div>
                </Link>
                <Button
                  size="sm"
                  variant="secondary"
                  className={`w-full mt-2 h-8 text-xs transition-all ${isAdded ? 'bg-green-600 hover:bg-green-600 text-white' : ''}`}
                  onClick={() => handleQuickAdd(product)}
                >
                  {isAdded ? (
                    'Tillagd!'
                  ) : (
                    <>
                      <Plus className="w-3 h-3 mr-1" />
                      {language === 'sv' ? 'Köp igen' : 'Buy again'}
                    </>
                  )}
                </Button>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default RecentlyViewed;
