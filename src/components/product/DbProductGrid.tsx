import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Loader2, ArrowUpDown } from 'lucide-react';
import { fetchDbProducts, DbProduct } from '@/lib/products';
import { categories } from '@/data/categories';
import { useLanguage, getContentLang } from '@/context/LanguageContext';
import { cn } from '@/lib/utils';
import { useSearchStore } from '@/stores/searchStore';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import DbProductCard from './DbProductCard';

type SortOption = 'default' | 'price-asc' | 'price-desc' | 'name-asc' | 'name-desc';

const DbProductGrid = () => {
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

  // Filter by category
  const categoryFiltered = useMemo(() => {
    if (activeCategory === 'all') return products;
    // Match product.category to category query
    const cat = categories.find(c => c.id === activeCategory);
    if (!cat || !cat.query) return products;
    const match = cat.query.match(/product_type:"?([^"&\s]+)"?/);
    if (!match) return products;
    const type = match[1].toLowerCase();
    return products.filter(p => (p.category || '').toLowerCase() === type);
  }, [products, activeCategory]);

  // Filter by search
  const searchFiltered = useMemo(() => {
    if (!searchQuery.trim()) return categoryFiltered;
    const q = searchQuery.toLowerCase();
    return categoryFiltered.filter(p =>
      p.title_sv.toLowerCase().includes(q) ||
      (p.title_en || '').toLowerCase().includes(q) ||
      (p.description_sv || '').toLowerCase().includes(q)
    );
  }, [categoryFiltered, searchQuery]);

  // Sort
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
    { value: 'default', label: lang === 'sv' ? 'Standard' : 'Default' },
    { value: 'price-asc', label: lang === 'sv' ? 'Pris: Lågt till högt' : 'Price: Low to High' },
    { value: 'price-desc', label: lang === 'sv' ? 'Pris: Högt till lågt' : 'Price: High to Low' },
    { value: 'name-asc', label: lang === 'sv' ? 'Namn: A-Ö' : 'Name: A-Z' },
    { value: 'name-desc', label: lang === 'sv' ? 'Namn: Ö-A' : 'Name: Z-A' },
  ];

  return (
    <section id="products" className="relative overflow-hidden py-8">
      <div className="container mx-auto px-4 relative z-10">
        {/* Category Filters */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex flex-wrap justify-center gap-3 mb-8"
        >
          {categories.map((category) => {
            const Icon = category.icon;
            const isActive = activeCategory === category.id;
            return (
              <motion.button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  "flex items-center gap-2.5 px-5 py-3 rounded-full text-sm font-medium transition-all duration-300",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                    : "bg-card hover:bg-secondary hover:shadow-md border border-border/60 text-muted-foreground hover:text-foreground hover:border-primary/30"
                )}
              >
                <Icon className="w-4 h-4" />
                <span>{category.name[lang] || category.name.en}</span>
              </motion.button>
            );
          })}
        </motion.div>

        {/* Sort */}
        {!isLoading && products.length > 0 && (
          <div className="flex justify-end mb-8">
            <Select value={sortOption} onValueChange={(v) => setSortOption(v as SortOption)}>
              <SelectTrigger className="w-[200px] bg-card border-border/60 rounded-xl h-11">
                <ArrowUpDown className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder={lang === 'sv' ? 'Sortera' : 'Sort'} />
              </SelectTrigger>
              <SelectContent className="bg-card border-border rounded-xl">
                {sortOptions.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
            <p className="text-muted-foreground font-medium">{t('products.loading')}</p>
          </div>
        )}

        {/* Error */}
        {error && !isLoading && (
          <div className="text-center py-16 text-destructive">{error}</div>
        )}

        {/* Empty */}
        {!isLoading && !error && sortedProducts.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-24"
          >
            <div className="w-20 h-20 rounded-2xl bg-secondary flex items-center justify-center mb-6">
              <Package className="w-10 h-10 text-muted-foreground/40" />
            </div>
            <h3 className="font-display text-xl font-semibold mb-3">{t('products.noproducts')}</h3>
            <p className="text-muted-foreground text-center max-w-md">
              {lang === 'sv'
                ? 'Inga produkter hittades. Lägg till produkter via adminpanelen!'
                : 'No products found. Add products via the admin panel!'}
            </p>
          </motion.div>
        )}

        {/* Grid */}
        {!isLoading && sortedProducts.length > 0 && (
          <motion.div layout className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
            <AnimatePresence mode="popLayout">
              {sortedProducts.map((product, index) => (
                <motion.div
                  key={product.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                >
                  <DbProductCard product={product} index={index} compact />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </section>
  );
};

export default DbProductGrid;
