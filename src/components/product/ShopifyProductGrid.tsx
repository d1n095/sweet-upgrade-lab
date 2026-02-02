import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Loader2, ArrowUpDown } from 'lucide-react';
import ShopifyProductCard from '@/components/product/ShopifyProductCard';
import { fetchProducts, ShopifyProduct } from '@/lib/shopify';
import { categories, Category } from '@/data/categories';
import { useLanguage } from '@/context/LanguageContext';
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

type SortOption = 'default' | 'price-asc' | 'price-desc' | 'name-asc' | 'name-desc';

// Helper to get visible categories from admin settings
const getVisibleCategories = (): Category[] => {
  const stored = localStorage.getItem('admin_categories');
  if (stored) {
    try {
      const adminCategories = JSON.parse(stored) as Array<{
        id: string;
        isVisible: boolean;
      }>;
      const visibleIds = adminCategories
        .filter(c => c.isVisible)
        .map(c => c.id);
      return categories.filter(c => visibleIds.includes(c.id));
    } catch {
      return categories;
    }
  }
  return categories;
};

// Helper to get hidden category product_types for filtering
const getHiddenCategoryQueries = (): string[] => {
  const stored = localStorage.getItem('admin_categories');
  if (stored) {
    try {
      const adminCategories = JSON.parse(stored) as Array<{
        id: string;
        isVisible: boolean;
      }>;
      const hiddenIds = adminCategories
        .filter(c => !c.isVisible)
        .map(c => c.id);
      
      // Map hidden category IDs to their product_type values
      return categories
        .filter(c => hiddenIds.includes(c.id) && c.query)
        .map(c => {
          // Extract product_type from query like 'product_type:CBD'
          const match = c.query?.match(/product_type:([^\s]+)/);
          return match ? match[1].replace(/"/g, '') : null;
        })
        .filter((v): v is string => v !== null);
    } catch {
      return [];
    }
  }
  return [];
};

const ShopifyProductGrid = () => {
  const { language, t } = useLanguage();
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [sortOption, setSortOption] = useState<SortOption>('default');
  const [bestsellerIds, setBestsellerIds] = useState<string[]>([]);
  const [visibleCategories, setVisibleCategories] = useState<Category[]>(getVisibleCategories());
  const searchQuery = useSearchStore(state => state.searchQuery);

  // Listen for category visibility updates
  useEffect(() => {
    const handleCategoriesUpdated = () => {
      setVisibleCategories(getVisibleCategories());
    };

    window.addEventListener('categories-updated', handleCategoriesUpdated);
    return () => {
      window.removeEventListener('categories-updated', handleCategoriesUpdated);
    };
  }, []);

  // Load bestseller IDs from database with realtime updates
  useEffect(() => {
    const loadBestsellerIds = async () => {
      const { data } = await supabase
        .from('product_sales')
        .select('shopify_product_id, total_quantity_sold')
        .gt('total_quantity_sold', 0)
        .order('total_quantity_sold', { ascending: false })
        .limit(5);
      
      if (data) {
        setBestsellerIds(data.map(item => item.shopify_product_id));
      }
    };
    loadBestsellerIds();

    // Subscribe to realtime changes for bestseller updates
    const channel = supabase
      .channel('bestseller-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'product_sales',
        },
        () => {
          // Reload bestseller IDs when sales data changes
          loadBestsellerIds();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const category = categories.find(c => c.id === activeCategory);
        
        // Check if this is the bestseller category
        if (category?.isBestsellerFilter) {
          // Load all products and filter by bestseller IDs
          const data = await fetchProducts(50);
          const filteredProducts = data.filter(p => bestsellerIds.includes(p.node.id));
          setProducts(filteredProducts);
        } else {
          let query = category?.query;
          
          if (searchQuery.trim()) {
            const searchFilter = `title:*${searchQuery}*`;
            query = query ? `${query} AND ${searchFilter}` : searchFilter;
          }
          
          const data = await fetchProducts(50, query);
          setProducts(data);
        }
      } catch (err) {
        console.error('Failed to load products:', err);
        setError(t('products.error'));
      } finally {
        setIsLoading(false);
      }
    };

    const debounce = setTimeout(loadProducts, 300);
    return () => clearTimeout(debounce);
  }, [activeCategory, searchQuery, t, bestsellerIds]);

  const handleCategoryClick = (categoryId: string) => {
    setActiveCategory(categoryId);
  };

  const sortedProducts = useMemo(() => {
    const sorted = [...products];
    switch (sortOption) {
      case 'price-asc':
        return sorted.sort((a, b) => 
          parseFloat(a.node.priceRange.minVariantPrice.amount) - parseFloat(b.node.priceRange.minVariantPrice.amount)
        );
      case 'price-desc':
        return sorted.sort((a, b) => 
          parseFloat(b.node.priceRange.minVariantPrice.amount) - parseFloat(a.node.priceRange.minVariantPrice.amount)
        );
      case 'name-asc':
        return sorted.sort((a, b) => a.node.title.localeCompare(b.node.title));
      case 'name-desc':
        return sorted.sort((a, b) => b.node.title.localeCompare(a.node.title));
      default:
        return sorted;
    }
  }, [products, sortOption]);

  // Filter out products from hidden categories
  const filteredProducts = useMemo(() => {
    const hiddenTypes = getHiddenCategoryQueries();
    if (hiddenTypes.length === 0) return sortedProducts;
    
    return sortedProducts.filter(product => {
      const productType = product.node.productType || '';
      // Check if product's type matches any hidden category
      return !hiddenTypes.some(hiddenType => 
        productType.toLowerCase().includes(hiddenType.toLowerCase())
      );
    });
  }, [sortedProducts]);

  // Listen for URL query params and hash changes
  useEffect(() => {
    const updateCategoryFromUrl = () => {
      // Check query params first (e.g., ?category=teknik)
      const urlParams = new URLSearchParams(window.location.search);
      const queryCategory = urlParams.get('category');
      if (queryCategory && categories.some(c => c.id === queryCategory)) {
        setActiveCategory(queryCategory);
        return;
      }
      
      // Fallback to hash (e.g., #category=teknik)
      const hash = window.location.hash;
      const match = hash.match(/category=([^&]+)/);
      if (match) {
        const categoryId = match[1];
        if (categories.some(c => c.id === categoryId)) {
          setActiveCategory(categoryId);
        }
      }
    };
    
    updateCategoryFromUrl();
    window.addEventListener('hashchange', updateCategoryFromUrl);
    window.addEventListener('popstate', updateCategoryFromUrl);
    return () => {
      window.removeEventListener('hashchange', updateCategoryFromUrl);
      window.removeEventListener('popstate', updateCategoryFromUrl);
    };
  }, []);

  const sortOptions = [
    { value: 'default', label: language === 'sv' ? 'Standard' : 'Default' },
    { value: 'price-asc', label: language === 'sv' ? 'Pris: Lågt till högt' : 'Price: Low to High' },
    { value: 'price-desc', label: language === 'sv' ? 'Pris: Högt till lågt' : 'Price: High to Low' },
    { value: 'name-asc', label: language === 'sv' ? 'Namn: A-Ö' : 'Name: A-Z' },
    { value: 'name-desc', label: language === 'sv' ? 'Namn: Ö-A' : 'Name: Z-A' },
  ];

  return (
    <section id="products" className="relative overflow-hidden py-8">
      <div className="container mx-auto px-4 relative z-10">
        {/* Category Filters */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="flex flex-wrap justify-center gap-3 mb-8"
        >
        {visibleCategories.map((category) => {
            const Icon = category.icon;
            const isActive = activeCategory === category.id;
            return (
              <motion.button
                key={category.id}
                onClick={() => handleCategoryClick(category.id)}
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
                className={cn(
                  "flex items-center gap-2.5 px-5 py-3 rounded-full text-sm font-medium transition-all duration-300",
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25" 
                    : "bg-card hover:bg-secondary hover:shadow-md border border-border/60 text-muted-foreground hover:text-foreground hover:border-primary/30"
                )}
              >
                <motion.div
                  animate={isActive ? { rotate: [0, -10, 10, 0] } : {}}
                  transition={{ duration: 0.5 }}
                >
                  <Icon className="w-4 h-4" />
                </motion.div>
                <span>{category.name[language] || category.name.en}</span>
              </motion.button>
            );
          })}
        </motion.div>

        {/* Sort dropdown */}
        {!isLoading && products.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-end mb-8"
          >
            <Select value={sortOption} onValueChange={(value) => setSortOption(value as SortOption)}>
              <SelectTrigger className="w-[200px] bg-card border-border/60 rounded-xl h-11">
                <ArrowUpDown className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder={language === 'sv' ? 'Sortera' : 'Sort'} />
              </SelectTrigger>
              <SelectContent className="bg-card border-border rounded-xl">
                {sortOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value} className="rounded-lg">
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </motion.div>
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
          <div className="text-center py-16 text-destructive">
            {error}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && products.length === 0 && (
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
              {language === 'sv' 
                ? 'Inga produkter hittades i denna kategori. Prova en annan kategori eller berätta vilka produkter du vill lägga till!'
                : 'No products found in this category. Try another category or tell us what products you\'d like to add!'
              }
            </p>
          </motion.div>
        )}

        {/* Products Grid */}
        {!isLoading && filteredProducts.length > 0 && (
          <motion.div layout className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
            <AnimatePresence mode="popLayout">
              {filteredProducts.map((product, index) => (
                <motion.div
                  key={product.node.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.4, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
                >
                  <ShopifyProductCard 
                    product={product} 
                    index={index} 
                    compact 
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </section>
  );
};

export default ShopifyProductGrid;