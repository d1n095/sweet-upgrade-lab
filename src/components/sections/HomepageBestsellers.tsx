import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import { useLanguage, getContentLang } from '@/context/LanguageContext';
import { fetchDbProducts, DbProduct } from '@/lib/products';
import DbProductCard from '@/components/product/DbProductCard';

const HomepageBestsellers = () => {
  const { language } = useLanguage();
  const lang = getContentLang(language);
  const [products, setProducts] = useState<DbProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const t = {
    sv: { title: 'Populära just nu', cta: 'Se alla produkter' },
    en: { title: 'Popular right now', cta: 'View all products' },
  }[lang];

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchDbProducts(false);
        // Prioritize bestseller-badged, then by display_order
        const bestsellers = data
          .filter(p => p.is_visible)
          .sort((a, b) => {
            if (a.badge === 'bestseller' && b.badge !== 'bestseller') return -1;
            if (b.badge === 'bestseller' && a.badge !== 'bestseller') return 1;
            return (a.display_order ?? 999) - (b.display_order ?? 999);
          })
          .slice(0, 4);
        setProducts(bestsellers);
      } catch (err) {
        console.error('Failed to load bestsellers:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <section className="py-24 md:py-32">
        <div className="container mx-auto px-5">
          <Skeleton className="h-8 w-48 mx-auto mb-14" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 max-w-5xl mx-auto">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-2xl" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (products.length === 0) return null;

  return (
    <section className="py-28 md:py-36 border-t border-border/30">
      <div className="container mx-auto px-5">
        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-2xl md:text-3xl font-semibold text-center mb-16 text-foreground"
        >
          {t.title}
        </motion.h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 max-w-5xl mx-auto mb-10">
          {products.map((product, index) => (
            <DbProductCard key={product.id} product={product} index={index} />
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <Link to="/produkter">
            <Button variant="outline" size="lg" className="group rounded-full">
              {t.cta}
              <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
};

export default HomepageBestsellers;
