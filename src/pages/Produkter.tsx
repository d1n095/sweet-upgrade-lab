import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Loader2, ArrowUpDown } from 'lucide-react';
import { fetchDbProducts, DbProduct } from '@/lib/products';
import { categories } from '@/data/categories';
import { useLanguage, getContentLang } from '@/context/LanguageContext';
import { cn } from '@/lib/utils';
import { useSearchStore } from '@/stores/searchStore';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import SEOHead from '@/components/seo/SEOHead';
import DbProductCard from '@/components/product/DbProductCard';

type SortOption = 'default' | 'price-asc' | 'price-desc' | 'name-asc' | 'name-desc';

const Produkter = () => {
  const { language, t } = useLanguage();
  const lang = getContentLang(language);
  const [products, setProducts] = useState<DbProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [sortOption, setSortOption] = useState<SortOption>('default');
  const searchQuery = useSearchStore(state => state.searchQuery);

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await fetchDbProducts(false);
        setProducts(data);
      } catch (err) {
        console.error('Failed to load products:', err);
        setError(t('products.error'));
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [t]);

  // Determine which categories have products
  const categoriesWithProducts = useMemo(() => {
    return categories.filter(cat => {
      if (cat.id === 'all') return true;
      if (cat.isBestsellerFilter) {
        return products.some(p => p.badge === 'bestseller');
      }
      const match = cat.query?.match(/product_type:"?([^"&\s]+)"?/);
      if (!match) return false;
      const type = match[1].toLowerCase();
      return products.some(p => (p.category || '').toLowerCase() === type);
    });
  }, [products]);

  const categoryFiltered = useMemo(() => {
    if (activeCategory === 'all') return products;
    const cat = categories.find(c => c.id === activeCategory);
    if (!cat) return products;
    if (cat.isBestsellerFilter) {
      return products.filter(p => p.badge === 'bestseller');
    }
    if (!cat.query) return products;
    const match = cat.query.match(/product_type:"?([^"&\s]+)"?/);
    if (!match) return products;
    const type = match[1].toLowerCase();
    return products.filter(p => (p.category || '').toLowerCase() === type);
  }, [products, activeCategory]);

  const searchFiltered = useMemo(() => {
    if (!searchQuery.trim()) return categoryFiltered;
    const q = searchQuery.toLowerCase();
    return categoryFiltered.filter(p =>
      p.title_sv.toLowerCase().includes(q) ||
      (p.title_en || '').toLowerCase().includes(q) ||
      (p.description_sv || '').toLowerCase().includes(q)
    );
  }, [categoryFiltered, searchQuery]);

  const sortedProducts = useMemo(() => {
    const sorted = [...searchFiltered];
    switch (sortOption) {
      case 'price-asc': return sorted.sort((a, b) => a.price - b.price);
      case 'price-desc': return sorted.sort((a, b) => b.price - a.price);
      case 'name-asc': return sorted.sort((a, b) => a.title_sv.localeCompare(b.title_sv));
      case 'name-desc': return sorted.sort((a, b) => b.title_sv.localeCompare(a.title_sv));
      default: return sorted;
    }
  }, [searchFiltered, sortOption]);

  const sortOptions = [
    { value: 'default', label: t('sort.default') },
    { value: 'price-asc', label: t('sort.pricelow') },
    { value: 'price-desc', label: t('sort.pricehigh') },
    { value: 'name-asc', label: t('sort.nameasc') },
    { value: 'name-desc', label: t('sort.namedesc') },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={t('shop.title')}
        description={t('shop.subtitle')}
        keywords="butik, shop, giftfri, naturlig, kroppsvård"
        canonical="/produkter"
      />
      <Header />

      <main className="pt-24 pb-20">
        <div className="container mx-auto px-4">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-10"
          >
            <h1 className="font-display text-4xl md:text-5xl font-semibold mb-4">
              {t('shop.title')}
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              {t('shop.subtitle')}
            </p>
          </motion.div>

          {/* Filters row - hide if only 1 category with products */}
          {categoriesWithProducts.length > 2 && (
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
              {/* Category Filters - hide empty */}
              <div className="flex flex-wrap gap-2">
                {categoriesWithProducts.map((category) => {
                  const Icon = category.icon;
                  const isActive = activeCategory === category.id;
                  return (
                    <button
                      key={category.id}
                      onClick={() => setActiveCategory(category.id)}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-all duration-200',
                        isActive
                          ? 'bg-foreground text-background'
                          : 'bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground border border-transparent'
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{category.name[lang] || category.name.en}</span>
                    </button>
                  );
                })}
              </div>

              {/* Sort */}
              {!isLoading && products.length > 0 && (
                <Select value={sortOption} onValueChange={(v) => setSortOption(v as SortOption)}>
                  <SelectTrigger className="w-[180px] bg-card border-border rounded-xl h-9 text-xs">
                    <ArrowUpDown className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                    <SelectValue placeholder={t('sort.label')} />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border rounded-xl">
                    {sortOptions.map(o => (
                      <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Sort only (when filters hidden) */}
          {categoriesWithProducts.length <= 2 && !isLoading && products.length > 0 && (
            <div className="flex justify-end mb-8">
              <Select value={sortOption} onValueChange={(v) => setSortOption(v as SortOption)}>
                <SelectTrigger className="w-[180px] bg-card border-border rounded-xl h-9 text-xs">
                  <ArrowUpDown className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                  <SelectValue placeholder={t('sort.label')} />
                </SelectTrigger>
                <SelectContent className="bg-card border-border rounded-xl">
                  {sortOptions.map(o => (
                    <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Loading */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-6 h-6 text-muted-foreground animate-spin mb-3" />
              <p className="text-sm text-muted-foreground">{t('products.loading')}</p>
            </div>
          )}

          {/* Error */}
          {error && !isLoading && (
            <div className="text-center py-16 text-sm text-destructive">{error}</div>
          )}

          {/* Empty */}
          {!isLoading && !error && sortedProducts.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20">
              <Package className="w-10 h-10 text-muted-foreground/30 mb-4" />
              <p className="font-semibold text-sm mb-1">{t('products.noproducts')}</p>
            </div>
          )}

          {/* Grid – max 4 columns */}
          {!isLoading && sortedProducts.length > 0 && (
            <motion.div layout className={cn(
              "grid gap-4 md:gap-5",
              sortedProducts.length <= 3
                ? "grid-cols-2 md:grid-cols-3 max-w-3xl mx-auto"
                : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
            )}>
              <AnimatePresence mode="popLayout">
                {sortedProducts.map((product, index) => (
                  <motion.div
                    key={product.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3 }}
                  >
                    <DbProductCard product={product} index={index} compact />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Produkter;
