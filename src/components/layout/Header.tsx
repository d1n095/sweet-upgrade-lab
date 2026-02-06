import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Menu, X, Leaf, ChevronDown, User, Crown, LogOut, Heart, Moon, Sun } from 'lucide-react';
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

const Header = () => {
  const { t, language } = useLanguage();
  const location = useLocation();
  const { user, isMember, signOut, loading: authLoading } = useAuth();
  const items = useCartStore(state => state.items);
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const wishlistItems = useWishlistStore(state => state.items);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProductsHovered, setIsProductsHovered] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [activeCategories, setActiveCategories] = useState(
    storeConfig.categories.filter(c => c.active)
  );

  // Ensure theme is mounted before rendering
  useEffect(() => {
    setMounted(true);
  }, []);

  // Listen for category visibility updates from AdminCategoryManager
  useEffect(() => {
    const handleCategoriesUpdated = (event: CustomEvent) => {
      const adminCategories = event.detail as Array<{
        id: string;
        name: { [key: string]: string };
        isVisible: boolean;
      }>;
      
      // Map admin categories to storeConfig format and filter visible ones
      const visibleIds = adminCategories
        .filter(c => c.isVisible)
        .map(c => c.id);
      
      // Update activeCategories based on visibility
      const updatedCategories = storeConfig.categories.filter(c => {
        // Map storeConfig id to admin category id
        const mappedId = c.id;
        return c.active && visibleIds.includes(mappedId);
      });
      
      setActiveCategories(updatedCategories);
    };

    // Load initial state from localStorage
    const stored = localStorage.getItem('admin_categories');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        handleCategoriesUpdated({ detail: parsed } as CustomEvent);
      } catch {
        // Keep default
      }
    }

    window.addEventListener('categories-updated', handleCategoriesUpdated as EventListener);
    return () => {
      window.removeEventListener('categories-updated', handleCategoriesUpdated as EventListener);
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const [isContactHovered, setIsContactHovered] = useState(false);

  const navLinks = [
    { href: '/shop', label: language === 'sv' ? 'Shop' : 'Shop' },
    { href: '/about', label: t('nav.about') },
    { href: '/how-it-works', label: language === 'sv' ? 'Så funkar det' : 'How It Works' },
    { href: '/whats-new', label: language === 'sv' ? 'Nytt hos oss' : "What's New" },
  ];
  
  const contactSubMenu = [
    { href: '/contact', label: language === 'sv' ? 'Kontakta oss' : 'Contact us' },
    { href: '/affiliate', label: language === 'sv' ? 'Samarbete' : 'Partnership' },
    { href: '/business', label: language === 'sv' ? 'Handla som företag' : 'Business' },
    { href: '/suggest-product', label: language === 'sv' ? 'Önska produkt' : 'Suggest product' },
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
          <div className="flex items-center justify-between h-18 md:h-20">
            {/* Logo */}
            <button
              onClick={() => {
                if (location.pathname === '/') {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                } else {
                  window.location.href = '/';
                }
              }}
              className="flex items-center gap-3 group cursor-pointer"
            >
              <div className="relative">
                <div className="w-11 h-11 rounded-xl bg-gradient-accent flex items-center justify-center shadow-lg shadow-accent/20">
                  <Leaf className="w-6 h-6 text-accent-foreground" />
                </div>
              </div>
              <span className="font-display text-xl font-semibold">
                4The<span className="text-gradient">People</span>
              </span>
            </button>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-8">
              {/* Products with dropdown */}
              <div 
                className="relative"
                onMouseEnter={() => setIsProductsHovered(true)}
                onMouseLeave={() => setIsProductsHovered(false)}
              >
                <Link
                  to="/shop"
                  className={`text-muted-foreground hover:text-foreground transition-colors relative group flex items-center gap-1.5 font-medium ${
                    location.pathname === '/shop' ? 'text-foreground' : ''
                  }`}
                >
                  {t('nav.products')}
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isProductsHovered ? 'rotate-180' : ''}`} />
                </Link>
                
                <AnimatePresence>
                  {isProductsHovered && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.98 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="absolute top-full left-0 mt-3 w-60 rounded-2xl bg-card border border-border shadow-elevated z-50 overflow-hidden"
                    >
                      <div className="p-2">
                        {activeCategories.map((category) => (
                          <Link
                            key={category.id}
                            to={`/shop?category=${category.id}`}
                            onClick={() => setIsProductsHovered(false)}
                            className="flex items-center gap-3 px-4 py-3 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all duration-200"
                          >
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Leaf className="w-4 h-4 text-primary" />
                            </div>
                            <span className="font-medium">{category.name?.[language as 'sv' | 'en'] ?? category.name?.en ?? category.name?.sv ?? ''}</span>
                          </Link>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {navLinks.slice(1).map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className={`text-muted-foreground hover:text-foreground transition-colors font-medium ${
                    location.pathname === link.href ? 'text-foreground' : ''
                  }`}
                >
                  {link.label}
                </Link>
              ))}

              {/* Contact with dropdown */}
              <div 
                className="relative"
                onMouseEnter={() => setIsContactHovered(true)}
                onMouseLeave={() => setIsContactHovered(false)}
              >
                <Link
                  to="/contact"
                  className={`text-muted-foreground hover:text-foreground transition-colors relative group flex items-center gap-1.5 font-medium ${
                    location.pathname === '/contact' || location.pathname === '/affiliate' || location.pathname === '/business' ? 'text-foreground' : ''
                  }`}
                >
                  {t('nav.contact')}
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isContactHovered ? 'rotate-180' : ''}`} />
                </Link>
                
                <AnimatePresence>
                  {isContactHovered && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.98 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="absolute top-full left-0 mt-3 w-56 rounded-2xl bg-card border border-border shadow-elevated z-50 overflow-hidden"
                    >
                      <div className="p-2">
                        {contactSubMenu.map((item) => (
                          <Link
                            key={item.href}
                            to={item.href}
                            onClick={() => setIsContactHovered(false)}
                            className="flex items-center gap-3 px-4 py-3 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all duration-200"
                          >
                            <span className="font-medium">{item.label}</span>
                          </Link>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </nav>

            {/* Search + Actions */}
            <div className="flex items-center gap-3 md:gap-4">
              {/* Search Field with Suggestions */}
              <div className="hidden sm:block">
                <SearchSuggestions />
              </div>
              
              {/* Dark mode toggle */}
              {mounted && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-full hover:bg-secondary"
                  onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
                  aria-label="Toggle dark mode"
                >
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={resolvedTheme}
                      initial={{ y: -20, opacity: 0, rotate: -90 }}
                      animate={{ y: 0, opacity: 1, rotate: 0 }}
                      exit={{ y: 20, opacity: 0, rotate: 90 }}
                      transition={{ duration: 0.2 }}
                    >
                      {resolvedTheme === 'dark' ? (
                        <Sun className="w-5 h-5" />
                      ) : (
                        <Moon className="w-5 h-5" />
                      )}
                    </motion.div>
                  </AnimatePresence>
                </Button>
              )}
              
              <LanguageSwitcher />

              {/* Auth/Account button */}
              {user ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden sm:flex h-10 w-10 rounded-full hover:bg-secondary relative"
                  onClick={() => setIsAccountOpen(true)}
                >
                  <User className="w-5 h-5" />
                  {isMember && (
                    <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-accent border-2 border-background" />
                  )}
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden sm:flex h-10 w-10 rounded-full hover:bg-secondary"
                  onClick={() => setIsAuthOpen(true)}
                >
                  <User className="w-5 h-5" />
                </Button>
              )}

              {/* Wishlist button */}
              <Button
                variant="ghost"
                size="icon"
                className="relative h-10 w-10 rounded-full hover:bg-secondary"
                onClick={() => setIsWishlistOpen(true)}
              >
                <Heart className="w-5 h-5" />
                <AnimatePresence>
                  {wishlistItems.length > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center shadow-lg"
                    >
                      {wishlistItems.length}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Button>

              {/* Cart button */}
              <Button
                variant="ghost"
                size="icon"
                className="relative h-10 w-10 rounded-full hover:bg-secondary"
                onClick={() => setIsCartOpen(true)}
              >
                <ShoppingCart className="w-5 h-5" />
                <AnimatePresence>
                  {totalItems > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shadow-lg"
                    >
                      {totalItems}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="md:hidden h-10 w-10 rounded-full"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="md:hidden bg-background/98 backdrop-blur-xl border-t border-border/50"
            >
              <nav className="container mx-auto px-4 py-6 flex flex-col gap-1">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    to={link.href}
                    className={`text-foreground font-medium py-3 px-4 rounded-xl hover:bg-secondary/50 transition-colors ${
                      location.pathname === link.href ? 'bg-secondary/50' : ''
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
                <div className="pl-4 flex flex-col gap-1 mt-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide px-4 py-2">
                    {language === 'sv' ? 'Kategorier' : 'Categories'}
                  </p>
                  {activeCategories.map((category) => (
                    <Link
                      key={category.id}
                      to={`/shop?category=${category.id}`}
                      className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors py-2.5 px-4 rounded-xl hover:bg-secondary/30"
                    >
                      <Leaf className="w-4 h-4 text-primary" />
                      {category.name?.[language as 'sv' | 'en'] ?? category.name?.en ?? category.name?.sv ?? ''}
                    </Link>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-border/50 flex flex-col gap-1">
                  {user ? (
                    <>
                      <button
                        onClick={() => {
                          setIsAccountOpen(true);
                          setIsMobileMenuOpen(false);
                        }}
                        className="flex items-center gap-3 text-foreground font-medium py-3 px-4 rounded-xl hover:bg-secondary/50 transition-colors text-left w-full"
                      >
                        <User className="w-5 h-5" />
                        {language === 'sv' ? 'Mitt konto' : 'My Account'}
                        {isMember && (
                          <span className="ml-auto flex items-center gap-1 text-xs text-accent">
                            <Crown className="w-4 h-4" />
                            Medlem
                          </span>
                        )}
                      </button>
                      <button
                        onClick={async () => {
                          await signOut();
                          setIsMobileMenuOpen(false);
                        }}
                        className="flex items-center gap-3 text-muted-foreground font-medium py-3 px-4 rounded-xl hover:bg-secondary/50 transition-colors text-left"
                      >
                        <LogOut className="w-5 h-5" />
                        {language === 'sv' ? 'Logga ut' : 'Sign out'}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => {
                        setIsAuthOpen(true);
                        setIsMobileMenuOpen(false);
                      }}
                      className="flex items-center gap-3 text-foreground font-medium py-3 px-4 rounded-xl hover:bg-secondary/50 transition-colors text-left"
                    >
                      <User className="w-5 h-5" />
                      {language === 'sv' ? 'Logga in / Skapa konto' : 'Sign in / Create account'}
                    </button>
                  )}
                  <Link
                    to="/track-order"
                    className="text-muted-foreground font-medium py-3 px-4 rounded-xl hover:bg-secondary/50 transition-colors"
                  >
                    {language === 'sv' ? 'Spåra order' : 'Track Order'}
                  </Link>
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