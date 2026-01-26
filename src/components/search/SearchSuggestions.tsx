import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Loader2, Package, ArrowRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useSearchStore } from '@/stores/searchStore';
import { useLanguage } from '@/context/LanguageContext';
import { fetchProducts, ShopifyProduct } from '@/lib/shopify';
import { Link, useNavigate } from 'react-router-dom';

const SearchSuggestions = () => {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const { searchQuery, setSearchQuery } = useSearchStore();
  const [suggestions, setSuggestions] = useState<ShopifyProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    // Handle clicks outside
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(async () => {
      if (isFocused) {
        setIsLoading(true);
        try {
          let products: ShopifyProduct[];
          if (searchQuery.trim()) {
            // Search with query
            products = await fetchProducts(5, `title:*${searchQuery}*`);
          } else {
            // Random suggestions when empty
            products = await fetchProducts(5);
          }
          setSuggestions(products);
          setShowSuggestions(true);
        } catch (error) {
          console.error('Failed to fetch suggestions:', error);
        } finally {
          setIsLoading(false);
        }
      }
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [searchQuery, isFocused]);

  const handleProductClick = (handle: string) => {
    setShowSuggestions(false);
    navigate(`/product/${handle}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setShowSuggestions(false);
      navigate('/shop');
    }
  };

  const formatPrice = (amount: string, currencyCode: string) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 0,
    }).format(parseFloat(amount));
  };

  return (
    <div ref={containerRef} className="relative">
      <form onSubmit={handleSearchSubmit}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder={language === 'sv' ? 'Sök...' : 'Search...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => {
              setIsFocused(true);
              setShowSuggestions(true);
            }}
            onBlur={() => setIsFocused(false)}
            className="pl-9 w-32 md:w-40 h-10 bg-secondary/50 border-transparent hover:border-border focus:border-primary/50 rounded-full text-sm transition-all"
          />
        </div>
      </form>

      <AnimatePresence>
        {showSuggestions && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute top-full left-0 right-0 mt-2 w-72 rounded-2xl bg-card border border-border shadow-elevated z-50 overflow-hidden"
          >
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : suggestions.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {language === 'sv' ? 'Inga produkter hittades' : 'No products found'}
              </div>
            ) : (
              <div className="p-2">
                <p className="px-3 py-2 text-xs text-muted-foreground uppercase tracking-wide">
                  {searchQuery.trim() 
                    ? (language === 'sv' ? 'Sökresultat' : 'Results')
                    : (language === 'sv' ? 'Populära produkter' : 'Popular products')}
                </p>
                {suggestions.map((product) => (
                  <button
                    key={product.node.id}
                    onClick={() => handleProductClick(product.node.handle)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-secondary/50 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                      {product.node.images.edges[0]?.node ? (
                        <img
                          src={product.node.images.edges[0].node.url}
                          alt={product.node.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{product.node.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatPrice(
                          product.node.priceRange.minVariantPrice.amount,
                          product.node.priceRange.minVariantPrice.currencyCode
                        )}
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  </button>
                ))}
                {searchQuery.trim() && (
                  <Link
                    to="/shop"
                    onClick={() => setShowSuggestions(false)}
                    className="flex items-center justify-center gap-2 px-3 py-2.5 mt-1 text-sm text-primary hover:bg-primary/5 rounded-xl transition-colors"
                  >
                    {language === 'sv' ? 'Se alla resultat' : 'View all results'}
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SearchSuggestions;
