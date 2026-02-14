import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { fetchProducts, ShopifyProduct } from '@/lib/shopify';
import ShopifyProductCard from '@/components/product/ShopifyProductCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const Bestsellers = () => {
  const { language } = useLanguage();
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const content = {
    sv: {
      badge: 'Populära produkter',
      title: 'Bästsäljare',
      subtitle: 'Våra mest efterfrågade produkter just nu',
      cta: 'Se alla produkter'
    },
    en: {
      badge: 'Popular products',
      title: 'Bestsellers',
      subtitle: 'Our most popular products right now',
      cta: 'View all products'
    }
  };

  const t = content[language] || content.en;

  useEffect(() => {
    const loadBestsellers = async () => {
      try {
        // First, try to get actual bestseller data from product_sales
        const { data: salesData, error: salesError } = await supabase
          .from('product_sales')
          .select('shopify_product_id, total_quantity_sold')
          .order('total_quantity_sold', { ascending: false })
          .limit(4);

        // Fetch all products
        const allProducts = await fetchProducts(50);

        if (salesData && salesData.length > 0 && !salesError) {
          // Sort products by sales data
          const productMap = new Map(allProducts.map(p => [
            p.node.id.replace('gid://shopify/Product/', ''),
            p
          ]));

          const sortedBestsellers: ShopifyProduct[] = [];
          
          // Add products in order of sales
          for (const sale of salesData) {
            const product = productMap.get(sale.shopify_product_id);
            if (product) {
              sortedBestsellers.push(product);
            }
          }

          // If we don't have enough, fill with remaining products
          if (sortedBestsellers.length < 4) {
            const usedIds = new Set(sortedBestsellers.map(p => p.node.id));
            for (const product of allProducts) {
              if (!usedIds.has(product.node.id) && sortedBestsellers.length < 4) {
                sortedBestsellers.push(product);
              }
            }
          }

          setProducts(sortedBestsellers);
        } else {
          // Fallback: just use first 4 products
          setProducts(allProducts.slice(0, 4));
        }
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
      <section className="py-16 md:py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10">
            <Skeleton className="h-6 w-32 mx-auto mb-3" />
            <Skeleton className="h-10 w-48 mx-auto mb-2" />
            <Skeleton className="h-5 w-64 mx-auto" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="aspect-[3/4] rounded-lg" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (products.length === 0) return null;

  return (
    <section className="py-16 md:py-20 bg-background">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            <TrendingUp className="w-4 h-4" />
            {t.badge}
          </span>
          <h2 className="font-display text-2xl md:text-3xl font-semibold mb-2">
            {t.title}
          </h2>
          <p className="text-muted-foreground">
            {t.subtitle}
          </p>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8">
          {products.slice(0, 4).map((product, index) => (
            <motion.div
              key={product.node.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <ShopifyProductCard product={product} index={index} compact isBestseller />
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <Link to="/shop">
            <Button variant="outline" size="lg" className="group">
              {t.cta}
              <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
};

export default Bestsellers;