import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Package, ClipboardList, Users, Loader2, ArrowRight,
  BarChart3, Grid, Star, Handshake, Wallet, FileText, Percent,
  Truck, Globe, Heart, Activity, Settings, Crown, Eye, Navigation,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface SearchResult {
  type: 'page' | 'order' | 'product' | 'user';
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

const typeIcons: Record<string, any> = {
  order: ClipboardList,
  product: Package,
  user: Users,
  page: Navigation,
};

const typeLabels: Record<string, string> = {
  order: 'Order',
  product: 'Produkt',
  user: 'Användare',
  page: 'Sida',
};

// Admin pages for quick navigation
const adminPages = [
  { label: 'Dashboard', keywords: ['dashboard', 'översikt', 'hem', 'start'], href: '/admin', icon: BarChart3 },
  { label: 'Ordrar', keywords: ['ordrar', 'orders', 'beställningar'], href: '/admin/orders', icon: ClipboardList },
  { label: 'Produkter', keywords: ['produkter', 'products', 'varor', 'lager'], href: '/admin/products', icon: Package },
  { label: 'Issues', keywords: ['issues', 'ärenden', 'buggar', 'problem', 'fel'], href: '/admin/issues', icon: ClipboardList },
  { label: 'Skanningar', keywords: ['skanningar', 'scans', 'scan', 'system'], href: '/admin/scans', icon: Activity },
  { label: 'Kategorier', keywords: ['kategorier', 'categories'], href: '/admin/categories', icon: Grid },
  { label: 'Användare', keywords: ['användare', 'members', 'kunder', 'medlemmar'], href: '/admin/members', icon: Users },
  { label: 'Recensioner', keywords: ['recensioner', 'reviews', 'omdömen'], href: '/admin/reviews', icon: Star },
  { label: 'Partners', keywords: ['partners', 'affiliates', 'influencers', 'samarbeten'], href: '/admin/partners', icon: Handshake },
  { label: 'Betalningar', keywords: ['betalningar', 'payments', 'finans', 'finance'], href: '/admin/finance', icon: Wallet },
  { label: 'Innehåll', keywords: ['innehåll', 'content', 'sidor', 'texter'], href: '/admin/content', icon: FileText },
  { label: 'Kampanjer', keywords: ['kampanjer', 'campaigns', 'rabatter', 'erbjudanden'], href: '/admin/campaigns', icon: Percent },
  { label: 'Frakt', keywords: ['frakt', 'shipping', 'leverans'], href: '/admin/shipping', icon: Truck },
  { label: 'SEO', keywords: ['seo', 'sökmotorer', 'meta'], href: '/admin/seo', icon: Globe },
  { label: 'Juridik & Donationer', keywords: ['juridik', 'legal', 'donationer', 'donations', 'villkor'], href: '/admin/legal', icon: Heart },
  { label: 'Logg', keywords: ['logg', 'logs', 'aktivitet', 'activity', 'fel', 'errors'], href: '/admin/logs', icon: Activity },
  { label: 'Inställningar', keywords: ['inställningar', 'settings', 'config'], href: '/admin/settings', icon: Settings },
  { label: 'Statistik', keywords: ['statistik', 'stats', 'analys', 'analytics'], href: '/admin/stats', icon: BarChart3 },
  { label: 'Personal', keywords: ['personal', 'staff', 'roller', 'roles'], href: '/admin/staff', icon: Crown },
  { label: 'Synlighet', keywords: ['synlighet', 'visibility', 'sidor'], href: '/admin/visibility', icon: Eye },
];

const AdminGlobalSearch = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const navigate = useNavigate();

  // Keyboard shortcut: Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Match admin pages instantly (no DB call)
  const pageResults = useMemo((): SearchResult[] => {
    const q = query.trim().toLowerCase();
    if (q.length < 1) return [];
    return adminPages
      .filter(p => p.label.toLowerCase().includes(q) || p.keywords.some(k => k.includes(q)))
      .map(p => ({
        type: 'page' as const,
        id: p.href,
        title: p.label,
        subtitle: 'Admin-sida',
        href: p.href,
      }));
  }, [query]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 2) {
      // Show page results immediately even for 1 char
      setResults(pageResults);
      setIsOpen(pageResults.length > 0);
      setSelectedIndex(-1);
      return;
    }

    // Show page results instantly, then DB results after debounce
    setResults(pageResults);
    setIsOpen(pageResults.length > 0);

    debounceRef.current = setTimeout(async () => {
      setIsLoading(true);
      const q = query.trim().toLowerCase();
      const dbResults: SearchResult[] = [];

      try {
        // Search orders
        const { data: orders } = await supabase
          .from('orders')
          .select('id, order_email, order_number, payment_intent_id, total_amount, status')
          .or(`order_email.ilike.%${q}%,order_number.ilike.%${q}%,payment_intent_id.ilike.%${q}%`)
          .limit(5);

        if (orders) {
          for (const o of orders) {
            const ref = o.payment_intent_id ? '#' + o.payment_intent_id.slice(-8).toUpperCase() : o.order_number || o.id.substring(0, 8);
            dbResults.push({
              type: 'order',
              id: o.id,
              title: ref,
              subtitle: `${o.order_email} · ${o.total_amount} SEK · ${o.status}`,
              href: '/admin/orders',
            });
          }
        }

        // Search products
        const { data: products } = await supabase
          .from('products')
          .select('id, title_sv, title_en, price, stock')
          .or(`title_sv.ilike.%${q}%,title_en.ilike.%${q}%`)
          .limit(5);

        if (products) {
          for (const p of products) {
            dbResults.push({
              type: 'product',
              id: p.id,
              title: p.title_sv,
              subtitle: `${p.price} SEK · ${p.stock} i lager`,
              href: '/admin/products',
            });
          }
        }

        // Search users
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
              dbResults.push({
                type: 'user',
                id: u.user_id,
                title: u.order_email,
                subtitle: 'Kund',
                href: '/admin/members',
              });
            }
          }
        }

        setResults([...pageResults, ...dbResults].slice(0, 12));
        setIsOpen(true);
      } catch (err) {

      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, pageResults]);

  const handleSelect = (result: SearchResult) => {
    setIsOpen(false);
    setQuery('');
    setSelectedIndex(-1);
    navigate(result.href);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev <= 0 ? results.length - 1 : prev - 1));
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Sök sidor, ordrar, produkter…"
          className="pl-9 pr-16 h-9 text-sm bg-secondary/50 border-border/50 rounded-xl w-72"
        />
        {isLoading ? (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-muted-foreground" />
        ) : (
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground/50 font-mono bg-secondary/80 px-1.5 py-0.5 rounded border border-border/50">
            ⌘K
          </kbd>
        )}
      </div>

      <AnimatePresence>
        {isOpen && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full mt-2 left-0 w-96 bg-card border border-border rounded-xl shadow-lg overflow-hidden z-50"
          >
            <div className="max-h-80 overflow-y-auto p-1.5">
              {/* Group: pages first, then DB results */}
              {results.filter(r => r.type === 'page').length > 0 && (
                <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">Sidor</p>
              )}
              {results.filter(r => r.type === 'page').map((result, i) => {
                const globalIdx = results.indexOf(result);
                const PageIcon = adminPages.find(p => p.href === result.href)?.icon || Navigation;
                return (
                  <button
                    key={`page-${result.id}`}
                    onClick={() => handleSelect(result)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left ${
                      globalIdx === selectedIndex ? 'bg-primary/10 text-primary' : 'hover:bg-secondary/50'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <PageIcon className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <span className="text-sm font-medium">{result.title}</span>
                    <ArrowRight className="w-3 h-3 text-muted-foreground/40 ml-auto" />
                  </button>
                );
              })}

              {results.filter(r => r.type !== 'page').length > 0 && (
                <p className="px-3 pt-3 pb-1 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">Resultat</p>
              )}
              {results.filter(r => r.type !== 'page').map((result) => {
                const globalIdx = results.indexOf(result);
                const Icon = typeIcons[result.type];
                return (
                  <button
                    key={`${result.type}-${result.id}`}
                    onClick={() => handleSelect(result)}
                    className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-lg transition-colors text-left ${
                      globalIdx === selectedIndex ? 'bg-primary/10' : 'hover:bg-secondary/50'
                    }`}
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
