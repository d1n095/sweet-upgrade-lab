import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import { useLanguage, getContentLang } from '@/context/LanguageContext';
import { fetchDbProducts, DbProduct } from '@/lib/products';
import DbProductCard from '@/components/product/DbProductCard';
import { PageSection } from '@/hooks/usePageSections';

interface Props {
  sections?: PageSection[];
  getSection?: (key: string) => PageSection | undefined;
  isSectionVisible?: (key: string) => boolean;
}

const HomepageNewProducts = ({ getSection }: Props) => {
  const { language } = useLanguage();
  const lang = getContentLang(language);
  const [products, setProducts] = useState<DbProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const section = getSection?.('new_products');
  const getLang = (sv: string | null | undefined, en: string | null | undefined) =>
    (lang === 'sv' ? sv : en) || sv || '';

  const title = section ? getLang(section.title_sv, section.title_en) : (lang === 'sv' ? 'Nya produkter' : 'New products');

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchDbProducts(false);
        const newest = data
          .filter(p => p.is_visible)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 4);
        setProducts(newest);
      } catch (err) {
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <section className="py-24 md:py-32 border-t border-border/30">
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
          {title}
        </motion.h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 max-w-5xl mx-auto mb-14">
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
              {lang === 'sv' ? 'Se alla produkter' : 'View all products'}
              <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
};

export default HomepageNewProducts;
