import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Menu, X, Leaf, ChevronDown, Search, User, Crown, LogOut, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCartStore } from '@/stores/cartStore';
import { useSearchStore } from '@/stores/searchStore';
import { useWishlistStore } from '@/stores/wishlistStore';
import { useLanguage } from '@/context/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import ShopifyCartDrawer from '@/components/cart/ShopifyCartDrawer';
import WishlistDrawer from '@/components/wishlist/WishlistDrawer';
import AuthModal from '@/components/auth/AuthModal';
import { useAuth } from '@/hooks/useAuth';
import { categories } from '@/data/categories';

const Header = () => {
  const { t, language } = useLanguage();
  const { user, isMember, signOut, loading: authLoading } = useAuth();
  const items = useCartStore(state => state.items);
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const { searchQuery, setSearchQuery } = useSearchStore();
  const wishlistItems = useWishlistStore(state => state.items);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProductsHovered, setIsProductsHovered] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
            <a href="/" className="flex items-center gap-3 group">
              <div className="relative">
                <div className="w-11 h-11 rounded-xl bg-gradient-accent flex items-center justify-center shadow-lg shadow-accent/20">
                  <Leaf className="w-6 h-6 text-accent-foreground" />
                </div>
              </div>
              <span className="font-display text-xl font-semibold">
                4The<span className="text-gradient">People</span>
              </span>
            </a>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-10">
              {/* Products with dropdown */}
              <div 
                className="relative"
                onMouseEnter={() => setIsProductsHovered(true)}
                onMouseLeave={() => setIsProductsHovered(false)}
              >
                <a
                  href="#products"
                  className="text-muted-foreground hover:text-foreground transition-colors relative group flex items-center gap-1.5 font-medium"
                >
                  {t('nav.products')}
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isProductsHovered ? 'rotate-180' : ''}`} />
                </a>
                
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
                        {categories.map((category) => {
                          const Icon = category.icon;
                          return (
                            <a
                              key={category.id}
                              href={`#products`}
                              onClick={(e) => {
                                e.preventDefault();
                                setIsProductsHovered(false);
                                window.location.hash = `products?category=${category.id}`;
                                document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
                              }}
                              className="flex items-center gap-3 px-4 py-3 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all duration-200"
                            >
                              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Icon className="w-4 h-4 text-primary" />
                              </div>
                              <span className="font-medium">{category.name[language]}</span>
                            </a>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <a
                href="#about"
                className="text-muted-foreground hover:text-foreground transition-colors font-medium"
              >
                {t('nav.about')}
              </a>
              <a
                href="#contact"
                className="text-muted-foreground hover:text-foreground transition-colors font-medium"
              >
                {t('nav.contact')}
              </a>
            </nav>

            {/* Search + Actions */}
            <div className="flex items-center gap-3 md:gap-4">
              {/* Search Field */}
              <div className="relative hidden sm:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder={language === 'sv' ? 'Sök produkter...' : 'Search products...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-44 md:w-56 h-10 bg-secondary/50 border-transparent hover:border-border focus:border-primary/50 rounded-full text-sm transition-all"
                />
              </div>
              <LanguageSwitcher />

              {/* Auth button */}
              {user ? (
                <div className="hidden sm:flex items-center gap-2">
                  {isMember && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20">
                      <Crown className="w-4 h-4 text-accent" />
                      <span className="text-xs font-medium text-accent">Medlem</span>
                    </div>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => signOut()}
                    className="h-10 w-10 rounded-full hover:bg-secondary"
                    title={language === 'sv' ? 'Logga ut' : 'Sign out'}
                  >
                    <LogOut className="w-5 h-5" />
                  </Button>
                </div>
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
                <a
                  href="#products"
                  className="text-foreground font-medium py-3 px-4 rounded-xl hover:bg-secondary/50 transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {t('nav.products')}
                </a>
                <div className="pl-4 flex flex-col gap-1 mb-2">
                  {categories.map((category) => {
                    const Icon = category.icon;
                    return (
                      <a
                        key={category.id}
                        href={`#products`}
                        className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors py-2.5 px-4 rounded-xl hover:bg-secondary/30"
                        onClick={(e) => {
                          e.preventDefault();
                          setIsMobileMenuOpen(false);
                          window.location.hash = `products?category=${category.id}`;
                          document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
                        }}
                      >
                        <Icon className="w-4 h-4 text-primary" />
                        {category.name[language]}
                      </a>
                    );
                  })}
                </div>
                <a
                  href="#about"
                  className="text-foreground font-medium py-3 px-4 rounded-xl hover:bg-secondary/50 transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {t('nav.about')}
                </a>
                <a
                  href="#contact"
                  className="text-foreground font-medium py-3 px-4 rounded-xl hover:bg-secondary/50 transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {t('nav.contact')}
                </a>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <ShopifyCartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
      <WishlistDrawer isOpen={isWishlistOpen} onClose={() => setIsWishlistOpen(false)} />
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </>
  );
};

export default Header;