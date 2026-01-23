import { Link } from 'react-router-dom';
import { Leaf, Mail, MessageCircle, Instagram, Facebook, CreditCard, Wallet, Send } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { storeConfig } from '@/config/storeConfig';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

const Footer = () => {
  const { t, language } = useLanguage();
  
  const quickLinks = [
    { href: '/shop', label: language === 'sv' ? 'Alla produkter' : 'All Products' },
    { href: '/about', label: t('nav.about') },
    { href: '/how-it-works', label: language === 'sv' ? 'Så funkar det' : 'How It Works' },
    { href: '/contact', label: t('nav.contact') },
    { href: '/track-order', label: language === 'sv' ? 'Spåra order' : 'Track Order' },
    { href: '/business', label: language === 'sv' ? 'Företagskunder' : 'Business Customers' },
    { href: '/affiliate', label: language === 'sv' ? 'Samarbete' : 'Partnership' },
  ];

  const customerServiceLinks = [
    { href: '/policies/shipping', label: t('footer.shippinginfo') },
    { href: '/policies/returns', label: t('footer.returns') },
    { href: '/policies/privacy', label: language === 'sv' ? 'Integritetspolicy' : 'Privacy Policy' },
    { href: '/policies/terms', label: language === 'sv' ? 'Villkor' : 'Terms & Conditions' },
  ];
  
  return (
    <footer className="bg-card border-t border-border/50 relative overflow-hidden">
      <div className="container mx-auto px-4 py-16 md:py-20 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 md:gap-12">
          {/* Brand */}
          <div className="lg:col-span-1">
            <Link to="/" className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 rounded-xl bg-gradient-accent flex items-center justify-center">
                <Leaf className="w-6 h-6 text-accent-foreground" />
              </div>
              <span className="font-display text-xl font-semibold">
                4The<span className="text-gradient">People</span>
              </span>
            </Link>
            <p className="text-muted-foreground text-sm leading-relaxed mb-6">
              {t('footer.description')}
            </p>
            
            {/* Contact info - simplified */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground mb-6">
              <span className="flex items-center gap-1.5">
                <Mail className="w-4 h-4 text-primary" />
                {storeConfig.contact.email}
              </span>
              <span className="flex items-center gap-1.5">
                <MessageCircle className="w-4 h-4 text-primary" />
                {language === 'sv' ? 'Snabb support' : 'Quick support'}
              </span>
              <span className="flex items-center gap-1.5">
                🌍 {language === 'sv' ? 'Leverans i Europa' : 'European delivery'}
              </span>
            </div>
            
            {/* Social links */}
            <div className="space-y-3">
              <p className="text-sm font-medium">{language === 'sv' ? 'Följ oss:' : 'Follow us:'}</p>
              <div className="flex items-center gap-3">
                <a
                  href={storeConfig.social.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  className="w-10 h-10 rounded-xl bg-secondary/50 hover:bg-primary/10 flex items-center justify-center text-muted-foreground hover:text-primary transition-all duration-200"
                >
                  <Instagram className="w-5 h-5" />
                </a>
                <a
                  href={storeConfig.social.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook"
                  className="w-10 h-10 rounded-xl bg-secondary/50 hover:bg-primary/10 flex items-center justify-center text-muted-foreground hover:text-primary transition-all duration-200"
                >
                  <Facebook className="w-5 h-5" />
                </a>
                <Link
                  to="/#newsletter"
                  aria-label="Newsletter"
                  className="w-10 h-10 rounded-xl bg-secondary/50 hover:bg-primary/10 flex items-center justify-center text-muted-foreground hover:text-primary transition-all duration-200"
                >
                  <Send className="w-5 h-5" />
                </Link>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-display font-semibold text-lg mb-5">{t('footer.quicklinks')}</h4>
            <ul className="space-y-3 text-sm">
              {quickLinks.map((link) => (
                <li key={link.href}>
                  <Link to={link.href} className="text-muted-foreground hover:text-foreground transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Customer Service */}
          <div>
            <h4 className="font-display font-semibold text-lg mb-5">{t('footer.customerservice')}</h4>
            <ul className="space-y-3 text-sm">
              {customerServiceLinks.map((link) => (
                <li key={link.href}>
                  <Link to={link.href} className="text-muted-foreground hover:text-foreground transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Payment Methods */}
          <div>
            <h4 className="font-display font-semibold text-lg mb-5">
              {language === 'sv' ? 'Betalsätt' : 'Payment'}
            </h4>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2 px-3 py-2 bg-secondary/50 rounded-lg">
                  <CreditCard className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm">Kort</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 bg-secondary/50 rounded-lg">
                  <Wallet className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm">Klarna</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 bg-secondary/50 rounded-lg">
                  <span className="text-sm font-medium">Swish</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                🔒 {language === 'sv' ? 'Säker betalning med SSL' : 'Secure SSL payment'}
              </p>
              <p className="text-sm text-primary font-medium">
                {language === 'sv' 
                  ? `Fri frakt över ${storeConfig.shipping.freeShippingThreshold} kr` 
                  : `Free shipping over ${storeConfig.shipping.freeShippingThreshold} SEK`}
              </p>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="decorative-line mt-12 mb-8" />
        
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-3">
            <p>© {new Date().getFullYear()} {storeConfig.company.name}. {t('footer.rights')}</p>
            <span className="text-xs opacity-60">Grundat 2026</span>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/policies/privacy" className="hover:text-foreground transition-colors">
              {language === 'sv' ? 'Integritetspolicy' : 'Privacy Policy'}
            </Link>
            <Link to="/policies/terms" className="hover:text-foreground transition-colors">
              {language === 'sv' ? 'Villkor' : 'Terms'}
            </Link>
            <Link to="/policies/returns" className="hover:text-foreground transition-colors">
              {language === 'sv' ? 'Returer' : 'Returns'}
            </Link>
            <LanguageSwitcher />
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;