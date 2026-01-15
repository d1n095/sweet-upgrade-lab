import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Flame, TrendingUp, Clock } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { fetchProducts, ShopifyProduct } from '@/lib/shopify';
import ShopifyProductCard from '@/components/product/ShopifyProductCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

const Bestsellers = () => {
  const { language } = useLanguage();
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const content = {
    sv: {
      badge: 'Populära val',
      title: 'Bästsäljare',
      subtitle: 'Våra mest älskade produkter – handplockade av våra kunder',
      urgency: 'Begränsat antal',
      selling: 'Säljer snabbt'
    },
    en: {
      badge: 'Popular picks',
      title: 'Bestsellers',
      subtitle: 'Our most loved products – handpicked by our customers',
      urgency: 'Limited stock',
      selling: 'Selling fast'
    }
  };

  const t = content[language];

  useEffect(() => {
    const loadBestsellers = async () => {
      try {
        const data = await fetchProducts(4);
        setProducts(data);
      } catch (error) {
        console.error('Error fetching bestsellers:', error);
      } finally {
        setLoading(false);
      }
    };

    loadBestsellers();
  }, []);

  if (loading) {
    return (
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <Skeleton className="h-8 w-40 mx-auto mb-4" />
            <Skeleton className="h-12 w-64 mx-auto mb-2" />
            <Skeleton className="h-6 w-96 mx-auto" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="aspect-[3/4] rounded-xl" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (products.length === 0) return null;

  return (
    <section className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            <Flame className="w-4 h-4" />
            {t.badge}
            <TrendingUp className="w-4 h-4" />
          </span>
          <h2 className="font-display text-3xl md:text-4xl font-semibold mb-3">
            {t.title}
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            {t.subtitle}
          </p>
          {/* Urgency banner */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="mt-4 inline-flex items-center gap-2"
          >
            <Badge variant="destructive" className="animate-pulse">
              <Clock className="w-3 h-3 mr-1" />
              {t.urgency}
            </Badge>
            <Badge variant="secondary">
              <TrendingUp className="w-3 h-3 mr-1" />
              {t.selling}
            </Badge>
          </motion.div>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {products.slice(0, 4).map((product, index) => (
            <motion.div
              key={product.node.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <ShopifyProductCard product={product} index={index} compact />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Bestsellers;
