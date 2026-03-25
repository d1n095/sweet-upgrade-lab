import { useEffect, useState, useMemo } from 'react';
import { usePurchaseHistory } from '@/hooks/usePurchaseHistory';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Loader2, ArrowUpDown, SlidersHorizontal } from 'lucide-react';
import { fetchDbProducts, DbProduct } from '@/lib/products';
import { useDbCategories } from '@/hooks/useDbCategories';
import { useLanguage, getContentLang } from '@/context/LanguageContext';
import { cn } from '@/lib/utils';
import { useSearchStore } from '@/stores/searchStore';
import { supabase } from '@/integrations/supabase/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import DbProductCard from './DbProductCard';
import UseCaseFilter from './UseCaseFilter';

type SortOption = 'default' | 'price-asc' | 'price-desc' | 'name-asc' | 'name-desc';

const DbProductGrid = () => {
  const { hasPurchased } = usePurchaseHistory();
  const { language, t } = useLanguage();
  const lang = getContentLang(language);
  const { categories } = useDbCategories();
  const [products, setProducts] = useState<DbProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [tagProductIds, setTagProductIds] = useState<Set<string> | null>(null);
  const [sortOption, setSortOption] = useState<SortOption>('default');
  const [showFilters, setShowFilters] = useState(false);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 5000]);
  const [maxPrice, setMaxPrice] = useState(5000);
  const searchQuery = useSearchStore(state => state.searchQuery);

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await fetchDbProducts(false);
        setProducts(data);
        if (data.length > 0) {
          const max = Math.ceil(Math.max(...data.map(p => p.price)) / 100) * 100;
          setMaxPrice(max);
          setPriceRange([0, max]);
        }
      } catch (err) {
        console.error('Failed to load products:', err);
        setError(t('products.error'));
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [t]);

  // Load tag filter product IDs
  useEffect(() => {
    if (!selectedTagId) {
      setTagProductIds(null);
      return;
    }
    const loadTagProducts = async () => {
      const { data } = await supabase
        .from('product_tag_relations')
        .select('product_id')
        .eq('tag_id', selectedTagId);
      setTagProductIds(new Set((data || []).map(r => r.product_id)));
    };
    loadTagProducts();
  }, [selectedTagId]);

  // Count products per category for hiding empty ones
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: products.length };
    categories.forEach(cat => {
      if (cat.id === 'all') return;
      if (cat.isBestsellerFilter) {
        counts[cat.id] = products.filter(p => p.badge === 'bestseller').length;
      } else if (cat.query) {
        const types = [...cat.query.matchAll(/product_type:"?([^"&\s]+)"?/g)].map(m => m[1].toLowerCase());
        counts[cat.id] = products.filter(p => types.includes((p.category || '').toLowerCase())).length;
      } else {
        counts[cat.id] = 0;
      }
    });
    return counts;
  }, [products, categories]);

  const categoryFiltered = useMemo(() => {
    let filtered = products;
    if (activeCategory !== 'all') {
      const cat = categories.find(c => c.id === activeCategory);
      if (cat) {
        if (cat.isBestsellerFilter) {
          filtered = filtered.filter(p => p.badge === 'bestseller');
        } else if (cat.query) {
          const types = [...cat.query.matchAll(/product_type:"?([^"&\s]+)"?/g)].map(m => m[1].toLowerCase());
          filtered = filtered.filter(p => types.includes((p.category || '').toLowerCase()));
        }
      }
    }
    // Apply tag filter
    if (tagProductIds) {
      filtered = filtered.filter(p => tagProductIds.has(p.id));
    }
    return filtered;
  }, [products, activeCategory, tagProductIds, categories]);

  const searchFiltered = useMemo(() => {
    let filtered = categoryFiltered;
    // Price filter
    if (priceRange[0] > 0 || priceRange[1] < maxPrice) {
      filtered = filtered.filter(p => p.price >= priceRange[0] && p.price <= priceRange[1]);
    }
    if (!searchQuery.trim()) return filtered;
    const q = searchQuery.toLowerCase();
    return filtered.filter(p =>
      p.title_sv.toLowerCase().includes(q) ||
      (p.title_en || '').toLowerCase().includes(q) ||
      (p.description_sv || '').toLowerCase().includes(q) ||
      (p.ingredients_sv || '').toLowerCase().includes(q) ||
      (p.ingredients_en || '').toLowerCase().includes(q)
    );
  }, [categoryFiltered, searchQuery, priceRange, maxPrice]);

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
    <section id="products" className="py-16 md:py-20">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold">{t('products.title')}</h2>
          </div>
          <div className="flex items-center gap-2">
            {!isLoading && products.length > 0 && (
              <>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 h-9 rounded-xl text-xs font-medium border transition-colors",
                    showFilters ? "bg-foreground text-background border-foreground" : "bg-card border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  {lang === 'sv' ? 'Filter' : 'Filters'}
                </button>
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
              </>
            )}
          </div>
        </div>

        {/* Price Filter Panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-6"
            >
              <div className="border border-border rounded-xl p-4 bg-card">
                <p className="text-xs font-semibold text-muted-foreground mb-3">
                  {lang === 'sv' ? 'Pris' : 'Price'}: {priceRange[0]} – {priceRange[1]} kr
                </p>
                <Slider
                  value={priceRange}
                  min={0}
                  max={maxPrice}
                  step={10}
                  onValueChange={(v) => setPriceRange(v as [number, number])}
                  className="w-full"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                  <span>0 kr</span>
                  <span>{maxPrice} kr</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Category Filters */}
        <div className="flex flex-wrap gap-2 mb-8">
          {categories
            .filter(cat => cat.id === 'all' || (!cat.parent_id && (categoryCounts[cat.id] ?? 0) > 0))
            .map((category) => {
            const Icon = category.icon;
            const isActive = activeCategory === category.id;
            return (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-all duration-200",
                  isActive
                    ? "bg-foreground text-background"
                    : "bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground border border-transparent"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{category.name[lang] || category.name.en}</span>
              </button>
            );
          })}
        </div>

        {/* Use Case / Tag Filters */}
        <div className="mb-8">
          <UseCaseFilter selectedTagId={selectedTagId} onSelect={setSelectedTagId} />
        </div>

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

        {/* Grid */}
        {!isLoading && sortedProducts.length > 0 && (
          <motion.div layout className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
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
                  <DbProductCard product={product} index={index} compact isPurchased={hasPurchased(product.id)} />
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
