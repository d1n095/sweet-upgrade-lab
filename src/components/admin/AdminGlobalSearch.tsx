import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Package, ClipboardList, Users, Loader2, ArrowRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface SearchResult {
  type: 'order' | 'product' | 'user';
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

const typeIcons = {
  order: ClipboardList,
  product: Package,
  user: Users,
};

const typeLabels = {
  order: 'Order',
  product: 'Produkt',
  user: 'Användare',
};

const AdminGlobalSearch = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsLoading(true);
      const q = query.trim().toLowerCase();
      const allResults: SearchResult[] = [];

      try {
        // Search orders by email or order number
        const { data: orders } = await supabase
          .from('orders')
          .select('id, order_email, shopify_order_number, total_amount, status')
          .or(`order_email.ilike.%${q}%,shopify_order_number.ilike.%${q}%`)
          .limit(5);

        if (orders) {
          for (const o of orders) {
            allResults.push({
              type: 'order',
              id: o.id,
              title: o.shopify_order_number || o.id.substring(0, 8),
              subtitle: `${o.order_email} · ${o.total_amount} SEK · ${o.status}`,
              href: '/admin/orders',
            });
          }
        }

        // Search products by title
        const { data: products } = await supabase
          .from('products')
          .select('id, title_sv, title_en, price, stock')
          .or(`title_sv.ilike.%${q}%,title_en.ilike.%${q}%`)
          .limit(5);

        if (products) {
          for (const p of products) {
            allResults.push({
              type: 'product',
              id: p.id,
              title: p.title_sv,
              subtitle: `${p.price} SEK · ${p.stock} i lager`,
              href: '/admin/products',
            });
          }
        }

        // Search profiles/orders by email (as user search)
        const { data: userOrders } = await supabase
          .from('orders')
          .select('user_id, order_email')
          .ilike('order_email', `%${q}%`)
          .limit(5);

        if (userOrders) {
          const seen = new Set<string>();
          for (const u of userOrders) {
            if (!seen.has(u.order_email)) {
              seen.add(u.order_email);
              allResults.push({
                type: 'user',
                id: u.user_id,
                title: u.order_email,
                subtitle: 'Kund',
                href: '/admin/members',
              });
            }
          }
        }

        setResults(allResults.slice(0, 10));
        setIsOpen(allResults.length > 0);
      } catch (err) {
        console.error('Admin search error:', err);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const handleSelect = (result: SearchResult) => {
    setIsOpen(false);
    setQuery('');
    navigate(result.href);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder="Sök ordrar, produkter, kunder..."
          className="pl-9 h-9 text-sm bg-secondary/50 border-border/50 rounded-xl w-64"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-muted-foreground" />
        )}
      </div>

      <AnimatePresence>
        {isOpen && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full mt-2 left-0 right-0 w-80 bg-card border border-border rounded-xl shadow-[var(--shadow-elevated)] overflow-hidden z-50"
          >
            <div className="max-h-80 overflow-y-auto p-1.5">
              {results.map((result) => {
                const Icon = typeIcons[result.type];
                return (
                  <button
                    key={`${result.type}-${result.id}`}
                    onClick={() => handleSelect(result)}
                    className="w-full flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-secondary/50 transition-colors text-left"
                  >
                    <div className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{result.title}</p>
                      <p className="text-[11px] text-muted-foreground/70 truncate">{result.subtitle}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground/50 font-medium uppercase mt-1 shrink-0">
                      {typeLabels[result.type]}
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminGlobalSearch;
