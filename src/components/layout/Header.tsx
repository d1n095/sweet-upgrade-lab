import { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Menu, X, Leaf, ChevronDown, User, Crown, LogOut, Heart, Moon, Sun, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCartStore } from '@/stores/cartStore';
import { useWishlistStore } from '@/stores/wishlistStore';
import { useLanguage } from '@/context/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import ShopifyCartDrawer from '@/components/cart/ShopifyCartDrawer';
import WishlistDrawer from '@/components/wishlist/WishlistDrawer';
import AuthModal from '@/components/auth/AuthModal';
import AccountDrawer from '@/components/auth/AccountDrawer';
import SearchSuggestions from '@/components/search/SearchSuggestions';
import { useAuth } from '@/hooks/useAuth';
import { storeConfig } from '@/config/storeConfig';
import { useTheme } from 'next-themes';
import { usePageVisibility } from '@/stores/pageVisibilityStore';
import { supabase } from '@/integrations/supabase/client';
import { categories as allCategoryDefs } from '@/data/categories';

// Dropdown that auto-closes on leave and renders as plain link when only 1 item
const NavDropdown = ({
  label,
  href,
  items,
  isActive,
}: {
  label: string;
  href: string;
  items: { href: string; label: string; icon?: React.ReactNode }[];
  isActive: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const handleEnter = () => {
    clearTimeout(timeoutRef.current);
    setOpen(true);
  };
  const handleLeave = () => {
    timeoutRef.current = setTimeout(() => setOpen(false), 150);
  };

  // Cleanup timeout on unmount
  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  // No items → plain link
  if (items.length === 0) {
    return (
      <Link
        to={href}
        className={`text-sm text-muted-foreground hover:text-foreground transition-colors font-medium py-2 ${isActive ? 'text-foreground' : ''}`}
      >
        {label}
      </Link>
    );
  }

  // Single item → direct link
  if (items.length === 1) {
    return (
      <Link
        to={items[0].href}
        className={`text-sm text-muted-foreground hover:text-foreground transition-colors font-medium py-2 ${isActive ? 'text-foreground' : ''}`}
      >
        {label}
      </Link>
    );
  }

  return (
    <div className="relative" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      <Link
        to={href}
        onClick={(e) => {
          // Click toggles dropdown on touch devices, navigates on desktop
          if ('ontouchstart' in window) {
            e.preventDefault();
            setOpen(prev => !prev);
          }
        }}
        className={`text-sm text-muted-foreground hover:text-foreground transition-colors font-medium flex items-center gap-1 py-2 ${isActive ? 'text-foreground' : ''}`}
      >
        {label}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </Link>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 pt-2 w-52 z-50"
          >
            <div className="rounded-xl bg-card border border-border shadow-[var(--shadow-elevated)] overflow-hidden p-1.5">
              {items.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                >
                  {item.icon}
                  <span className="font-medium">{item.label}</span>
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Header = () => {
  const { t, language, contentLang } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isMember, signOut, loading: authLoading } = useAuth();
  const items = useCartStore(state => state.items);
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const wishlistItems = useWishlistStore(state => state.items);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { isVisible } = usePageVisibility();
  const [activeCategories, setActiveCategories] = useState(
    storeConfig.categories.filter(c => c.active)
  );
  const [productCategories, setProductCategories] = useState<string[]>([]);

  useEffect(() => { setMounted(true); }, []);

  // Fetch product categories once to know which categories have products
  useEffect(() => {
    supabase
      .from('products')
      .select('category, badge')
      .eq('is_visible', true)
      .then(({ data }) => {
        if (!data || data.length === 0) {
          setProductCategories([]);
          return;
        }
        const cats = new Set<string>();
        const hasBestseller = data.some(p => p.badge === 'bestseller');
        if (hasBestseller) cats.add('bestsaljare');
        data.forEach(p => {
          if (p.category) cats.add(p.category.toLowerCase());
        });
        setProductCategories(Array.from(cats));
      });
  }, []);

  useEffect(() => {
    const handleCategoriesUpdated = (event: CustomEvent) => {
      const adminCategories = event.detail as Array<{ id: string; name: { [key: string]: string }; isVisible: boolean }>;
      const visibleIds = adminCategories.filter(c => c.isVisible).map(c => c.id);
      const updatedCategories = storeConfig.categories.filter(c => c.active && visibleIds.includes(c.id));
      setActiveCategories(updatedCategories);
    };

    const stored = localStorage.getItem('admin_categories');
    if (stored) {
      try {
        handleCategoriesUpdated({ detail: JSON.parse(stored) } as CustomEvent);
      } catch { /* keep default */ }
    }

    window.addEventListener('categories-updated', handleCategoriesUpdated as EventListener);
    return () => window.removeEventListener('categories-updated', handleCategoriesUpdated as EventListener);
  }, []);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => { setIsMobileMenuOpen(false); setMobileSearchOpen(false); }, [location.pathname]);

  const aboutSubMenu = [
    { href: '/about', label: t('nav.aboutus') },
    ...(isVisible('donations') ? [{ href: '/donations', label: t('nav.donations') }] : []),
  ];

  const contactSubMenu = [
    { href: '/contact', label: t('nav.contactus') },
    ...(isVisible('affiliate') ? [{ href: '/affiliate', label: t('nav.partnership') }] : []),
    ...(isVisible('business') ? [{ href: '/business', label: t('nav.business') }] : []),
    ...(isVisible('suggest-product') ? [{ href: '/suggest-product', label: t('nav.suggestproduct') }] : []),
  ];

  // Only show categories that actually have products — simple ID-based matching
  const productDropdownItems = useMemo(() => {
    if (productCategories.length === 0) return [];
    
    return activeCategories
      .filter(c => {
        if ((c.id as string) === 'all') return false;
        const catDef = allCategoryDefs.find(cd => cd.id === c.id);
        if (!catDef) return false;
        
        // Bestseller filter — check if any product has bestseller badge
        if (catDef.isBestsellerFilter) {
          return productCategories.includes('bestsaljare');
        }
        
        // Match category ID directly against product.category values from DB
        // The product.category field stores values like "Kroppsvård", "Elektronik" etc.
        // Category query has format: product_type:Kroppsvård or product_type:"Hampa-kläder" OR product_type:Kläder
        if (!catDef.query) return false;
        
        // Extract all product_type values from the query
        const typeMatches = catDef.query.matchAll(/product_type:"?([^"&\s]+)"?/g);
        for (const match of typeMatches) {
          if (productCategories.includes(match[1].toLowerCase())) return true;
        }
        return false;
      })
      .map(c => ({
        href: `/shop?category=${c.id}`,
        label: c.name?.[language] ?? c.name?.[contentLang] ?? c.name?.en ?? c.name?.sv ?? '',
        icon: <Leaf className="w-3.5 h-3.5 text-muted-foreground" />,
      }));
  }, [activeCategories, productCategories, language, contentLang]);

  const allMobileLinks = [
    { href: '/produkter', label: 'Shop' },
    ...(isVisible('whats-new') ? [{ href: '/whats-new', label: t('nav.whatsnew') }] : []),
    ...aboutSubMenu,
    ...contactSubMenu,
    { href: '/track-order', label: t('nav.trackorder') },
  ];

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled
            ? 'bg-background/95 backdrop-blur-xl shadow-sm border-b border-border/50'
            : 'bg-transparent'
        }`}
      >
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-14 md:h-15 gap-2">
            {/* Logo */}
            <button
              onClick={() => {
                if (location.pathname === '/') {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                } else {
                  navigate('/');
                }
              }}
              className="flex items-center gap-2.5 group cursor-pointer min-h-[44px] shrink-0"
            >
              <div className="w-9 h-9 rounded-lg bg-gradient-accent flex items-center justify-center shadow-sm">
                <Leaf className="w-5 h-5 text-accent-foreground" />
              </div>
              <span className="font-display text-lg font-semibold">
                4The<span className="text-gradient">People</span>
              </span>
            </button>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-5 min-w-0 overflow-visible">
              {productDropdownItems.length > 0 ? (
                <NavDropdown
                  label="Shop"
                  href="/shop"
                  items={productDropdownItems}
                  isActive={location.pathname === '/shop' || location.pathname === '/produkter'}
                />
              ) : (
                <Link
                  to="/shop"
                  className={`text-sm font-semibold px-4 py-1.5 rounded-full transition-all ${
                    location.pathname === '/shop'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary/60 text-foreground hover:bg-secondary'
                  }`}
                >
                  Shop
                </Link>
              )}

              <NavDropdown
                label={t('nav.about')}
                href="/about"
                items={aboutSubMenu}
                isActive={location.pathname === '/about' || location.pathname === '/donations'}
              />

              {isVisible('whats-new') && (
                <Link
                  to="/whats-new"
                  className={`text-sm text-muted-foreground hover:text-foreground transition-colors font-medium py-2 whitespace-nowrap ${
                    location.pathname === '/whats-new' ? 'text-foreground' : ''
                  }`}
                >
                  {t('nav.whatsnew')}
                </Link>
              )}

              <NavDropdown
                label={t('nav.contact')}
                href="/contact"
                items={contactSubMenu}
                isActive={['/contact', '/affiliate', '/business'].includes(location.pathname)}
              />
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-0 sm:gap-0.5 md:gap-1 shrink-0">
              {/* Desktop search */}
              <div className="hidden sm:block">
                <SearchSuggestions />
              </div>

              {/* Mobile search icon */}
              <Button
                variant="ghost"
                size="icon"
                className="sm:hidden h-9 w-9 rounded-full hover:bg-secondary"
                onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
              >
                <Search className="w-[18px] h-[18px]" />
              </Button>

              {mounted && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden sm:flex h-9 w-9 md:h-10 md:w-10 rounded-full hover:bg-secondary"
                  onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
                  aria-label="Toggle dark mode"
                >
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={resolvedTheme}
                      initial={{ y: -16, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: 16, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      {resolvedTheme === 'dark' ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
                    </motion.div>
                  </AnimatePresence>
                </Button>
              )}

              <div className="hidden sm:block">
                <LanguageSwitcher />
              </div>

              {user ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 md:h-10 md:w-10 rounded-full hover:bg-secondary relative"
                  onClick={() => setIsAccountOpen(true)}
                >
                  <User className="w-[17px] h-[17px] md:w-[18px] md:h-[18px]" />
                  {isMember && (
                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-accent border-2 border-background" />
                  )}
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 md:h-10 md:w-10 rounded-full hover:bg-secondary"
                  onClick={() => setIsAuthOpen(true)}
                >
                  <User className="w-[17px] h-[17px] md:w-[18px] md:h-[18px]" />
                </Button>
              )}

              <Button
                variant="ghost"
                size="icon"
                className="relative h-9 w-9 md:h-10 md:w-10 rounded-full hover:bg-secondary"
                onClick={() => setIsWishlistOpen(true)}
              >
                <Heart className="w-[17px] h-[17px] md:w-[18px] md:h-[18px]" />
                <AnimatePresence>
                  {wishlistItems.length > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      className="absolute -top-0.5 -right-0.5 w-4 h-4 md:w-4.5 md:h-4.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center"
                    >
                      {wishlistItems.length}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="relative h-9 w-9 md:h-10 md:w-10 rounded-full hover:bg-secondary"
                onClick={() => setIsCartOpen(true)}
              >
                <ShoppingCart className="w-[17px] h-[17px] md:w-[18px] md:h-[18px]" />
                <AnimatePresence>
                  {totalItems > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center"
                    >
                      {totalItems}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="md:hidden h-9 w-9 rounded-full"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Search Bar */}
        <AnimatePresence>
          {mobileSearchOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="sm:hidden bg-background/95 backdrop-blur-xl border-t border-border/50 overflow-hidden"
            >
              <div className="container mx-auto px-4 py-3">
                <SearchSuggestions />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="md:hidden bg-background border-t border-border/50 overflow-hidden"
            >
              <nav className="container mx-auto px-4 py-4 flex flex-col">
                {allMobileLinks.map((link) => (
                  <Link
                    key={link.href}
                    to={link.href}
                    className={`text-sm font-medium py-3 px-4 rounded-xl hover:bg-secondary/50 transition-colors min-h-[44px] flex items-center ${
                      location.pathname === link.href ? 'bg-secondary/50 text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}

                {/* Mobile-only: dark mode & language */}
                <div className="flex items-center gap-2 px-4 py-3 sm:hidden">
                  {mounted && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 rounded-xl h-10 flex-1"
                      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
                    >
                      {resolvedTheme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                      {resolvedTheme === 'dark' ? (language === 'sv' ? 'Ljust läge' : 'Light mode') : (language === 'sv' ? 'Mörkt läge' : 'Dark mode')}
                    </Button>
                  )}
                  <div className="flex-1 flex justify-center">
                    <LanguageSwitcher />
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-border/50">
                  {user ? (
                    <>
                      <button
                        onClick={() => { setIsAccountOpen(true); setIsMobileMenuOpen(false); }}
                        className="flex items-center gap-3 text-sm font-medium py-3 px-4 rounded-xl hover:bg-secondary/50 transition-colors text-left w-full min-h-[44px]"
                      >
                        <User className="w-4.5 h-4.5" />
                        {t('nav.myaccount')}
                        {isMember && (
                          <span className="ml-auto flex items-center gap-1 text-xs text-accent">
                            <Crown className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </button>
                      <button
                        onClick={async () => { await signOut(); setIsMobileMenuOpen(false); }}
                        className="flex items-center gap-3 text-sm text-muted-foreground font-medium py-3 px-4 rounded-xl hover:bg-secondary/50 transition-colors text-left w-full min-h-[44px]"
                      >
                        <LogOut className="w-4.5 h-4.5" />
                        {t('nav.signout')}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => { setIsAuthOpen(true); setIsMobileMenuOpen(false); }}
                      className="flex items-center gap-3 text-sm font-medium py-3 px-4 rounded-xl hover:bg-secondary/50 transition-colors text-left w-full min-h-[44px]"
                    >
                      <User className="w-4.5 h-4.5" />
                      {t('nav.signin')}
                    </button>
                  )}
                </div>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <ShopifyCartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
      <WishlistDrawer isOpen={isWishlistOpen} onClose={() => setIsWishlistOpen(false)} />
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
      <AccountDrawer isOpen={isAccountOpen} onClose={() => setIsAccountOpen(false)} />
    </>
  );
};

export default Header;
