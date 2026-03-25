import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Loader2, ArrowUpDown, SlidersHorizontal } from 'lucide-react';
import { fetchDbProducts, DbProduct } from '@/lib/products';
import { useDbCategories } from '@/hooks/useDbCategories';
import { useLanguage, getContentLang } from '@/context/LanguageContext';
import { cn } from '@/lib/utils';
import { useSearchStore } from '@/stores/searchStore';
import { supabase } from '@/integrations/supabase/client';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import SEOHead from '@/components/seo/SEOHead';
import DbProductCard from '@/components/product/DbProductCard';
import UseCaseFilter from '@/components/product/UseCaseFilter';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';

type SortOption = 'default' | 'price-asc' | 'price-desc' | 'name-asc' | 'name-desc';

const Produkter = () => {
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
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 2000]);
  const [maxPrice, setMaxPrice] = useState(2000);
  const [showFilters, setShowFilters] = useState(false);
  const searchQuery = useSearchStore(state => state.searchQuery);

  // Load product→category mappings to accurately filter categories
  const [productCategoryMap, setProductCategoryMap] = useState<Record<string, Set<string>>>({});
  const [slugToUuid, setSlugToUuid] = useState<Record<string, string>>({});

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const [data, { data: pcData }, { data: rawCats }] = await Promise.all([
          fetchDbProducts(false),
          supabase.from('product_categories').select('product_id, category_id'),
          supabase.from('categories').select('id, slug'),
        ]);
        setProducts(data);
        // Build category UUID → product IDs map
        const catMap: Record<string, Set<string>> = {};
        (pcData || []).forEach((r: any) => {
          if (!catMap[r.category_id]) catMap[r.category_id] = new Set();
          catMap[r.category_id].add(r.product_id);
        });
        setProductCategoryMap(catMap);
        // Build slug → UUID map
        const s2u: Record<string, string> = {};
        (rawCats || []).forEach((c: any) => { s2u[c.slug] = c.id; });
        setSlugToUuid(s2u);
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
    if (!selectedTagId) { setTagProductIds(null); return; }
    const loadTagProducts = async () => {
      const { data } = await supabase
        .from('product_tag_relations')
        .select('product_id')
        .eq('tag_id', selectedTagId);
      setTagProductIds(new Set((data || []).map(r => r.product_id)));
    };
    loadTagProducts();
  }, [selectedTagId]);

  const categoriesWithProducts = useMemo(() => {
    const visibleProductIds = new Set(products.map(p => p.id));
    return categories.filter((cat) => {
      if (cat.id === 'all') return true;
      if (cat.parent_id) return false;
      if (cat.isBestsellerFilter) return products.some(p => p.badge === 'bestseller');
      // Resolve category slug → UUID, then check junction table
      const uuid = slugToUuid[cat.slug || cat.id];
      if (uuid && productCategoryMap[uuid]) {
        for (const pid of productCategoryMap[uuid]) {
          if (visibleProductIds.has(pid)) return true;
        }
      }
      return false;
    });
  }, [products, categories, productCategoryMap, slugToUuid]);

  const filtered = useMemo(() => {
    let result = products;

    // Category filter
    if (activeCategory !== 'all') {
      const cat = categories.find(c => c.id === activeCategory);
      if (cat?.isBestsellerFilter) {
        result = result.filter(p => p.badge === 'bestseller');
      } else if (cat) {
        const uuid = slugToUuid[cat.slug || cat.id];
        const catProductIds = uuid ? productCategoryMap[uuid] : null;
        if (catProductIds) {
          result = result.filter(p => catProductIds.has(p.id));
        } else {
          // Fallback to category field match
          const match = cat.query?.match(/product_type:"?([^"&\s]+)"?/);
          if (match) {
            const type = match[1].toLowerCase();
            result = result.filter(p => (p.category || '').toLowerCase() === type);
          }
        }
      }
    }

    // Tag filter
    if (tagProductIds) {
      result = result.filter(p => tagProductIds.has(p.id));
    }

    // Price filter
    result = result.filter(p => p.price >= priceRange[0] && p.price <= priceRange[1]);

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.title_sv.toLowerCase().includes(q) ||
        (p.title_en || '').toLowerCase().includes(q) ||
        (p.description_sv || '').toLowerCase().includes(q) ||
        (p.ingredients_sv || '').toLowerCase().includes(q)
      );
    }

    return result;
  }, [products, activeCategory, tagProductIds, priceRange, searchQuery, categories, slugToUuid, productCategoryMap]);

  const sortedProducts = useMemo(() => {
    const sorted = [...filtered];
    switch (sortOption) {
      case 'price-asc': return sorted.sort((a, b) => a.price - b.price);
      case 'price-desc': return sorted.sort((a, b) => b.price - a.price);
      case 'name-asc': return sorted.sort((a, b) => a.title_sv.localeCompare(b.title_sv));
      case 'name-desc': return sorted.sort((a, b) => b.title_sv.localeCompare(a.title_sv));
      default: return sorted;
    }
  }, [filtered, sortOption]);

  const sortOptions = [
    { value: 'default', label: t('sort.default') },
    { value: 'price-asc', label: t('sort.pricelow') },
    { value: 'price-desc', label: t('sort.pricehigh') },
    { value: 'name-asc', label: t('sort.nameasc') },
    { value: 'name-desc', label: t('sort.namedesc') },
  ];

  const formatPrice = (amount: number) =>
    new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', minimumFractionDigits: 0 }).format(amount);

  const activeFilterCount = (selectedTagId ? 1 : 0) + (priceRange[0] > 0 || priceRange[1] < maxPrice ? 1 : 0) + (activeCategory !== 'all' ? 1 : 0);

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title={t('shop.title')} description={t('shop.subtitle')} keywords="butik, shop, giftfri, naturlig, kroppsvård" canonical="/produkter" />
      <Header />

      <main className="pt-24 pb-20">
        <div className="container mx-auto px-4">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
            <h1 className="font-display text-4xl md:text-5xl font-semibold mb-4">{t('shop.title')}</h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">{t('shop.subtitle')}</p>
          </motion.div>

          {/* Use case tags */}
          <div className="mb-6">
            <UseCaseFilter selectedTagId={selectedTagId} onSelect={setSelectedTagId} />
          </div>

          {/* Toolbar */}
          <div className="flex items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-2">
              <Button
                variant={showFilters ? "default" : "outline"}
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="rounded-xl gap-1.5 h-9 text-xs"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Filter
                {activeFilterCount > 0 && (
                  <span className="bg-primary-foreground text-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-0.5">{activeFilterCount}</span>
                )}
              </Button>
              <span className="text-xs text-muted-foreground">{sortedProducts.length} {lang === 'sv' ? 'produkter' : 'products'}</span>
            </div>

            {!isLoading && products.length > 0 && (
              <Select value={sortOption} onValueChange={(v) => setSortOption(v as SortOption)}>
                <SelectTrigger className="w-[160px] bg-card border-border rounded-xl h-9 text-xs">
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

          {/* Expandable filter panel */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="bg-card border border-border rounded-2xl p-5 mb-6 space-y-5">
                  {/* Categories */}
                  {categoriesWithProducts.length > 2 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">{lang === 'sv' ? 'Kategori' : 'Category'}</p>
                      <div className="flex flex-wrap gap-2">
                        {categoriesWithProducts.map((category) => {
                          const Icon = category.icon;
                          const isActive = activeCategory === category.id;
                          return (
                            <button
                              key={category.id}
                              onClick={() => setActiveCategory(category.id)}
                              className={cn(
                                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 active:scale-[0.97]',
                                isActive ? 'bg-foreground text-background' : 'bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground'
                              )}
                            >
                              <Icon className="w-3 h-3" />
                              <span>{category.name[lang] || category.name.en}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Price range */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">{lang === 'sv' ? 'Pris' : 'Price'}: {formatPrice(priceRange[0])} – {formatPrice(priceRange[1])}</p>
                    <Slider
                      min={0}
                      max={maxPrice}
                      step={10}
                      value={priceRange}
                      onValueChange={(v) => setPriceRange(v as [number, number])}
                      className="w-full"
                    />
                  </div>

                  {/* Reset */}
                  {activeFilterCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setActiveCategory('all'); setSelectedTagId(null); setPriceRange([0, maxPrice]); }}
                      className="text-xs text-muted-foreground"
                    >
                      {lang === 'sv' ? 'Rensa filter' : 'Clear filters'}
                    </Button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Loading */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-6 h-6 text-muted-foreground animate-spin mb-3" />
              <p className="text-sm text-muted-foreground">{t('products.loading')}</p>
            </div>
          )}

          {error && !isLoading && (
            <div className="text-center py-16 text-sm text-destructive">{error}</div>
          )}

          {!isLoading && !error && sortedProducts.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20">
              <Package className="w-10 h-10 text-muted-foreground/30 mb-4" />
              <p className="font-semibold text-sm mb-1">{t('products.noproducts')}</p>
            </div>
          )}

          {/* Grid */}
          {!isLoading && sortedProducts.length > 0 && (
            <motion.div layout className={cn(
              "grid gap-4 md:gap-5",
              sortedProducts.length <= 3
                ? "grid-cols-2 md:grid-cols-3 max-w-3xl mx-auto"
                : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
            )}>
              <AnimatePresence mode="popLayout">
                {sortedProducts.map((product, index) => (
                  <motion.div key={product.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.3 }}>
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
