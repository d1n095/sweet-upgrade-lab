import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Loader2, Package, ArrowRight, FlaskConical, Tag, Clock, X } from 'lucide-react';
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

interface CategoryResult {
  id: string;
  name_sv: string;
  name_en: string | null;
  slug: string;
}

const RECENT_SEARCHES_KEY = '4tp_recent_searches';
const MAX_RECENT = 5;

function getRecentSearches(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || '[]');
  } catch { return []; }
}

function addRecentSearch(term: string) {
  const recent = getRecentSearches().filter(s => s !== term);
  recent.unshift(term);
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

function clearRecentSearches() {
  localStorage.removeItem(RECENT_SEARCHES_KEY);
}

const SearchSuggestions = () => {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const { searchQuery, setSearchQuery } = useSearchStore();
  const [suggestions, setSuggestions] = useState<DbProductResult[]>([]);
  const [comingSoon, setComingSoon] = useState<DbProductResult[]>([]);
  const [ingredientMatches, setIngredientMatches] = useState<string[]>([]);
  const [categoryMatches, setCategoryMatches] = useState<CategoryResult[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
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
          // Search products
          const { data } = await supabase
            .from('products')
            .select('id, title_sv, title_en, handle, price, currency, image_urls, ingredients_sv, ingredients_en, status, tags')
            .eq('is_visible', true)
            .in('status', ['active', 'coming_soon', 'info'])
            .or(`title_sv.ilike.%${q}%,title_en.ilike.%${q}%,ingredients_sv.ilike.%${q}%,ingredients_en.ilike.%${q}%,tags.cs.{${q}}`)
            .limit(12);

          // Search tags for extra products
          const { data: tagMatches } = await supabase
            .from('product_tags')
            .select('id, name_sv')
            .ilike('name_sv', `%${q}%`)
            .limit(5);

          let tagProductIds: string[] = [];
          if (tagMatches && tagMatches.length > 0) {
            const tagIds = tagMatches.map(t => t.id);
            const { data: relations } = await supabase
              .from('product_tag_relations')
              .select('product_id')
              .in('tag_id', tagIds);
            tagProductIds = (relations || []).map(r => r.product_id);
          }

          const existingIds = new Set((data || []).map(p => p.id));
          const missingTagProductIds = tagProductIds.filter(id => !existingIds.has(id));
          let extraProducts: DbProductResult[] = [];
          if (missingTagProductIds.length > 0) {
            const { data: tagProds } = await supabase
              .from('products')
              .select('id, title_sv, title_en, handle, price, currency, image_urls, ingredients_sv, ingredients_en, status')
              .in('id', missingTagProductIds.slice(0, 4))
              .eq('is_visible', true)
              .in('status', ['active', 'coming_soon', 'info']);
            extraProducts = (tagProds || []) as DbProductResult[];
          }

          // Search categories
          const { data: catData } = await supabase
            .from('categories')
            .select('id, name_sv, name_en, slug')
            .eq('is_visible', true)
            .is('parent_id', null)
            .ilike('name_sv', `%${q}%`)
            .limit(4);
          setCategoryMatches((catData || []) as CategoryResult[]);

          // Search ingredients
          const { data: ingData } = await supabase
            .from('recipe_ingredients')
            .select('id, name_sv, name_en')
            .eq('is_active', true)
            .eq('is_searchable', true)
            .or(`name_sv.ilike.%${q}%,name_en.ilike.%${q}%`)
            .limit(5);

          // Split active vs coming_soon
          const allResults = [...((data || []) as DbProductResult[]), ...extraProducts];
          const active = allResults.filter(p => p.status === 'active');
          const soon = allResults.filter(p => p.status === 'coming_soon');
          const info = allResults.filter(p => p.status === 'info');

          setSuggestions([...active, ...info].slice(0, 6));
          setComingSoon(soon.slice(0, 3));

          logSearchStandalone(q, allResults.length);

          // Ingredient matches
          const matched = new Set<string>();
          (data || []).forEach((p: any) => {
            const ingStr = language === 'sv' ? p.ingredients_sv : (p.ingredients_en || p.ingredients_sv);
            if (ingStr) {
              ingStr.split(',').map((s: string) => s.trim()).filter(Boolean).forEach((ing: string) => {
                if (ing.toLowerCase().includes(q)) matched.add(ing);
              });
            }
          });
          (ingData || []).forEach((ing: any) => {
            const name = language === 'sv' ? ing.name_sv : (ing.name_en || ing.name_sv);
            if (name) matched.add(name);
          });
          setIngredientMatches([...matched].slice(0, 5));

          if (matched.size > 0) {
            trackEvent('ingredient_search', { query: q, matched_ingredients: [...matched] });
          }
        } else {
          // Empty query — show popular products
          const { data } = await supabase
            .from('products')
            .select('id, title_sv, title_en, handle, price, currency, image_urls, ingredients_sv, ingredients_en, status')
            .eq('is_visible', true)
            .eq('status', 'active')
            .limit(5);
          setSuggestions((data || []) as DbProductResult[]);
          setComingSoon([]);
          setIngredientMatches([]);
          setCategoryMatches([]);
          setRecentSearches(getRecentSearches());
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
    if (searchQuery.trim()) addRecentSearch(searchQuery.trim());
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
      addRecentSearch(searchQuery.trim());
      setShowSuggestions(false);
      navigate('/produkter');
    }
  };

  const handleRecentClick = (term: string) => {
    setSearchQuery(term);
  };

  const formatPrice = (price: number, currency: string) =>
    new Intl.NumberFormat('sv-SE', { style: 'currency', currency, minimumFractionDigits: 0 }).format(price);

  const sv = language === 'sv';
  const title = (p: DbProductResult) => sv ? p.title_sv : (p.title_en || p.title_sv);

  const ProductRow = ({ product }: { product: DbProductResult }) => (
    <button
      onMouseDown={(e) => { e.preventDefault(); handleProductClick(product.handle, product.id); }}
      className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left hover:bg-secondary/50 transition-colors"
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
          {product.status === 'info' && (
            <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-[10px] font-medium">
              Info
            </span>
          )}
        </div>
        {product.status === 'active' && (
          <p className="text-xs text-muted-foreground">{formatPrice(product.price, product.currency)}</p>
        )}
      </div>
      <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
    </button>
  );

  const hasResults = suggestions.length > 0 || comingSoon.length > 0 || ingredientMatches.length > 0 || categoryMatches.length > 0;
  const hasQuery = searchQuery.trim().length > 0;

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
            onFocus={() => { setIsFocused(true); setShowSuggestions(true); setRecentSearches(getRecentSearches()); }}
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
            className="absolute top-full left-0 right-0 mt-2 w-80 rounded-2xl bg-card border border-border shadow-elevated z-50 overflow-hidden max-h-[70vh] overflow-y-auto"
          >
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : !hasQuery && recentSearches.length > 0 ? (
              <div className="p-2">
                {/* Recent searches */}
                <div className="px-3 py-2 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {sv ? 'Senaste sökningar' : 'Recent searches'}
                  </p>
                  <button
                    onMouseDown={(e) => { e.preventDefault(); clearRecentSearches(); setRecentSearches([]); }}
                    className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {sv ? 'Rensa' : 'Clear'}
                  </button>
                </div>
                {recentSearches.map(term => (
                  <button
                    key={term}
                    onMouseDown={(e) => { e.preventDefault(); handleRecentClick(term); }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-sm hover:bg-secondary/50 transition-colors"
                  >
                    <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>{term}</span>
                  </button>
                ))}

                {/* Popular products */}
                {suggestions.length > 0 && (
                  <>
                    <p className="px-3 py-2 text-xs text-muted-foreground uppercase tracking-wide mt-1">
                      {sv ? 'Populära produkter' : 'Popular products'}
                    </p>
                    {suggestions.map(product => <ProductRow key={product.id} product={product} />)}
                  </>
                )}
              </div>
            ) : !hasResults && hasQuery ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {sv ? 'Inga resultat hittades' : 'No results found'}
              </div>
            ) : (
              <div className="p-2">
                {/* Category matches */}
                {categoryMatches.length > 0 && (
                  <div className="px-3 py-2">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1">
                      <Tag className="w-3 h-3" />
                      {sv ? 'Kategorier' : 'Categories'}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {categoryMatches.map(cat => (
                        <Link
                          key={cat.id}
                          to={`/produkter?category=${cat.slug}`}
                          onMouseDown={(e) => { e.preventDefault(); setShowSuggestions(false); navigate(`/produkter?category=${cat.slug}`); }}
                          className="inline-flex items-center px-2.5 py-1 rounded-full bg-secondary text-foreground text-xs font-medium hover:bg-secondary/80 transition-colors"
                        >
                          {sv ? cat.name_sv : (cat.name_en || cat.name_sv)}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Ingredient matches */}
                {ingredientMatches.length > 0 && (
                  <div className="px-3 py-2">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1">
                      <FlaskConical className="w-3 h-3" />
                      {sv ? 'Ingredienser' : 'Ingredients'}
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

                {/* Active products */}
                {suggestions.length > 0 && (
                  <>
                    <p className="px-3 py-2 text-xs text-muted-foreground uppercase tracking-wide">
                      {hasQuery ? (sv ? 'Produkter' : 'Products') : (sv ? 'Populära produkter' : 'Popular products')}
                    </p>
                    {suggestions.map(product => <ProductRow key={product.id} product={product} />)}
                  </>
                )}

                {/* Coming soon */}
                {comingSoon.length > 0 && (
                  <>
                    <p className="px-3 py-2 text-xs text-muted-foreground uppercase tracking-wide mt-1">
                      {sv ? 'Kommer snart' : 'Coming soon'}
                    </p>
                    {comingSoon.map(product => <ProductRow key={product.id} product={product} />)}
                  </>
                )}

                {/* View all */}
                {hasQuery && (
                  <Link
                    to="/produkter"
                    onClick={() => { addRecentSearch(searchQuery.trim()); setShowSuggestions(false); }}
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
