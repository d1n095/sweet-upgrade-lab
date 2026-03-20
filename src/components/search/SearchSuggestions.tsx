import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Loader2, Package, ArrowRight, FlaskConical } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useSearchStore } from '@/stores/searchStore';
import { useLanguage } from '@/context/LanguageContext';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { trackEvent } from '@/utils/analyticsTracker';
import { logSearchStandalone } from '@/hooks/useInsightLogger';

interface DbProductResult {
  id: string;
  title_sv: string;
  title_en: string | null;
  handle: string | null;
  price: number;
  currency: string;
  image_urls: string[] | null;
  ingredients_sv: string | null;
  ingredients_en: string | null;
  status: string;
}

const SearchSuggestions = () => {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const { searchQuery, setSearchQuery } = useSearchStore();
  const [suggestions, setSuggestions] = useState<DbProductResult[]>([]);
  const [ingredientMatches, setIngredientMatches] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowSuggestions(false);
        setSearchQuery('');
        const input = containerRef.current?.querySelector('input');
        input?.blur();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [setSearchQuery]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      if (!isFocused) return;
      setIsLoading(true);
      try {
        const q = searchQuery.trim().toLowerCase();

        if (q) {
          // Search products by title AND ingredients
          const { data } = await supabase
            .from('products')
            .select('id, title_sv, title_en, handle, price, currency, image_urls, ingredients_sv, ingredients_en, status')
            .eq('is_visible', true)
            .in('status', ['active', 'coming_soon', 'info'])
            .or(`title_sv.ilike.%${q}%,title_en.ilike.%${q}%,ingredients_sv.ilike.%${q}%,ingredients_en.ilike.%${q}%`)
            .limit(8);

          // Search ingredients from recipe_ingredients
          const { data: ingData } = await supabase
            .from('recipe_ingredients')
            .select('id, name_sv, name_en')
            .eq('is_active', true)
            .eq('is_searchable', true)
            .or(`name_sv.ilike.%${q}%,name_en.ilike.%${q}%`)
            .limit(5);

          // Sort: active first, then coming_soon, then info
          const statusOrder: Record<string, number> = { active: 0, coming_soon: 1, info: 2 };
          const sorted = ((data || []) as DbProductResult[]).sort((a, b) => {
            return (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3);
          });
          setSuggestions(sorted);

          // Log search to search_logs for admin analytics
          logSearchStandalone(q, (data || []).length);

          // Find which ingredients matched (from both product text and ingredient DB)
          const matched = new Set<string>();
          (data || []).forEach((p: any) => {
            const ingStr = language === 'sv' ? p.ingredients_sv : (p.ingredients_en || p.ingredients_sv);
            if (ingStr) {
              ingStr.split(',').map((s: string) => s.trim()).filter(Boolean).forEach((ing: string) => {
                if (ing.toLowerCase().includes(q)) matched.add(ing);
              });
            }
          });
          // Also add DB ingredient matches
          (ingData || []).forEach((ing: any) => {
            const name = language === 'sv' ? ing.name_sv : (ing.name_en || ing.name_sv);
            if (name) matched.add(name);
          });
          setIngredientMatches([...matched].slice(0, 5));

          // Track ingredient search
          if (matched.size > 0) {
            trackEvent('ingredient_search', { query: q, matched_ingredients: [...matched] });
          }
        } else {
          // Random suggestions
          const { data } = await supabase
            .from('products')
            .select('id, title_sv, title_en, handle, price, currency, image_urls, ingredients_sv, ingredients_en, status')
            .eq('is_visible', true)
            .eq('status', 'active')
            .limit(5);
          setSuggestions((data || []) as DbProductResult[]);
          setIngredientMatches([]);
        }
        setShowSuggestions(true);
      } catch (error) {
        console.error('Failed to fetch suggestions:', error);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery, isFocused, language]);

  const handleProductClick = (handle: string | null, productId: string) => {
    setShowSuggestions(false);
    trackEvent('search_product_click', { product_id: productId, query: searchQuery });
    if (handle) navigate(`/product/${handle}`);
  };

  const handleIngredientClick = (ingredient: string) => {
    trackEvent('ingredient_click', { ingredient, query: searchQuery });
    setSearchQuery(ingredient);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setShowSuggestions(false);
      navigate('/produkter');
    }
  };

  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
    }).format(price);
  };

  const sv = language === 'sv';
  const title = (p: DbProductResult) => sv ? p.title_sv : (p.title_en || p.title_sv);

  return (
    <div ref={containerRef} className="relative">
      <form onSubmit={handleSearchSubmit}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder={sv ? 'Sök produkt eller ingrediens...' : 'Search product or ingredient...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => { setIsFocused(true); setShowSuggestions(true); }}
            onBlur={() => setIsFocused(false)}
            className="pl-9 w-full sm:w-40 md:w-44 lg:w-48 max-w-xs h-10 bg-secondary/50 border-transparent hover:border-border focus:border-primary/50 rounded-full text-sm transition-all"
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
                {sv ? 'Inga produkter hittades' : 'No products found'}
              </div>
            ) : (
              <div className="p-2">
                {/* Ingredient matches */}
                {ingredientMatches.length > 0 && (
                  <div className="px-3 py-2">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1">
                      <FlaskConical className="w-3 h-3" />
                      {sv ? 'Matchande ingredienser' : 'Matching ingredients'}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {ingredientMatches.map(ing => (
                        <button
                          key={ing}
                          onMouseDown={(e) => { e.preventDefault(); handleIngredientClick(ing); }}
                          className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs hover:bg-primary/20 transition-colors"
                        >
                          {ing}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <p className="px-3 py-2 text-xs text-muted-foreground uppercase tracking-wide">
                  {searchQuery.trim()
                    ? (sv ? 'Sökresultat' : 'Results')
                    : (sv ? 'Populära produkter' : 'Popular products')}
                </p>
                {suggestions.map((product) => (
                  <button
                    key={product.id}
                    onMouseDown={(e) => { e.preventDefault(); handleProductClick(product.handle, product.id); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-secondary/50 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                      {product.image_urls?.[0] ? (
                        <img src={product.image_urls[0]} alt={title(product)} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium truncate">{title(product)}</p>
                        {product.status === 'coming_soon' && (
                          <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[10px] font-medium">
                            {sv ? 'Kommer snart' : 'Coming soon'}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatPrice(product.price, product.currency)}
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  </button>
                ))}
                {searchQuery.trim() && (
                  <Link
                    to="/produkter"
                    onClick={() => setShowSuggestions(false)}
                    className="flex items-center justify-center gap-2 px-3 py-2.5 mt-1 text-sm text-primary hover:bg-primary/5 rounded-xl transition-colors"
                  >
                    {sv ? 'Se alla resultat' : 'View all results'}
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
