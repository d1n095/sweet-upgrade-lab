import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Loader2, ArrowUpDown } from 'lucide-react';
import ShopifyProductCard from '@/components/product/ShopifyProductCard';
import { fetchProducts, ShopifyProduct } from '@/lib/shopify';
import { categories } from '@/data/categories';
import { useLanguage } from '@/context/LanguageContext';
import { cn } from '@/lib/utils';
import { useSearchStore } from '@/stores/searchStore';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SortOption = 'default' | 'price-asc' | 'price-desc' | 'name-asc' | 'name-desc';

const ShopifyProductGrid = () => {
  const { language, t } = useLanguage();
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [sortOption, setSortOption] = useState<SortOption>('default');
  const searchQuery = useSearchStore(state => state.searchQuery);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const category = categories.find(c => c.id === activeCategory);
        let query = category?.query;
        
        // Add search query if present
        if (searchQuery.trim()) {
          const searchFilter = `title:*${searchQuery}*`;
          query = query ? `${query} AND ${searchFilter}` : searchFilter;
        }
        
        const data = await fetchProducts(50, query);
        setProducts(data);
      } catch (err) {
        console.error('Failed to load products:', err);
        setError(t('products.error'));
      } finally {
        setIsLoading(false);
      }
    };

    const debounce = setTimeout(loadProducts, 300);
    return () => clearTimeout(debounce);
  }, [activeCategory, searchQuery, t]);

  const handleCategoryClick = (categoryId: string) => {
    setActiveCategory(categoryId);
  };

  // Sort products
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

  // Expose setActiveCategory for external use
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      const match = hash.match(/category=([^&]+)/);
      if (match) {
        const categoryId = match[1];
        if (categories.some(c => c.id === categoryId)) {
          setActiveCategory(categoryId);
        }
      }
    };
    
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const sortOptions = [
    { value: 'default', label: language === 'sv' ? 'Standard' : 'Default' },
    { value: 'price-asc', label: language === 'sv' ? 'Pris: Lågt till högt' : 'Price: Low to High' },
    { value: 'price-desc', label: language === 'sv' ? 'Pris: Högt till lågt' : 'Price: High to Low' },
    { value: 'name-asc', label: language === 'sv' ? 'Namn: A-Ö' : 'Name: A-Z' },
    { value: 'name-desc', label: language === 'sv' ? 'Namn: Ö-A' : 'Name: Z-A' },
  ];

  return (
    <section id="products" className="py-20 md:py-32">
      <div className="container mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-8 md:mb-12"
        >
          <h2 className="font-display text-3xl md:text-5xl font-bold mb-4">
            {t('products.title').split(' ')[0]} <span className="text-gradient">{t('products.title').split(' ').slice(1).join(' ')}</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {language === 'sv' 
              ? 'Utforska vårt sortiment av hållbara kläder, hudvård och hygienprodukter'
              : 'Explore our range of sustainable clothing, skincare and hygiene products'
            }
          </p>
        </motion.div>

        {/* Category Filters */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex flex-wrap justify-center gap-2 md:gap-3 mb-10 md:mb-14"
        >
          {categories.map((category) => {
            const Icon = category.icon;
            const isActive = activeCategory === category.id;
            return (
              <button
                key={category.id}
                onClick={() => handleCategoryClick(category.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-all duration-200",
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25" 
                    : "bg-card hover:bg-muted border border-border text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="w-4 h-4" />
                <span>{category.name[language]}</span>
              </button>
            );
          })}
        </motion.div>

        {/* Sort dropdown */}
        {!isLoading && products.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-end mb-6"
          >
            <Select value={sortOption} onValueChange={(value) => setSortOption(value as SortOption)}>
              <SelectTrigger className="w-[200px] bg-card border-border">
                <ArrowUpDown className="w-4 h-4 mr-2" />
                <SelectValue placeholder={language === 'sv' ? 'Sortera' : 'Sort'} />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {sortOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </motion.div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
            <p className="text-muted-foreground">{t('products.loading')}</p>
          </div>
        )}

        {/* Error */}
        {error && !isLoading && (
          <div className="text-center py-12 text-destructive">
            {error}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && products.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20"
          >
            <Package className="w-16 h-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-xl font-semibold mb-2">{t('products.noproducts')}</h3>
            <p className="text-muted-foreground text-center max-w-md">
              {language === 'sv' 
                ? 'Inga produkter hittades i denna kategori. Prova en annan kategori eller berätta vilka produkter du vill lägga till!'
                : 'No products found in this category. Try another category or tell us what products you\'d like to add!'
              }
            </p>
          </motion.div>
        )}

        {/* Products Grid - Compact 5 columns */}
        {!isLoading && sortedProducts.length > 0 && (
          <motion.div layout className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            <AnimatePresence mode="popLayout">
              {sortedProducts.map((product, index) => (
                <motion.div
                  key={product.node.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.2, delay: index * 0.03 }}
                >
                  <ShopifyProductCard product={product} index={index} compact />
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
