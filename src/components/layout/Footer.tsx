import { Link } from 'react-router-dom';
import { Leaf, Mail, Clock, Instagram, Facebook, Send } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { storeConfig } from '@/config/storeConfig';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import PaymentIcons from '@/components/trust/PaymentIcons';

const Footer = () => {
  const { t, language } = useLanguage();
  
  const footerContent = {
    sv: {
      quickLinks: 'Snabblänkar',
      customerService: 'Kundtjänst',
      payment: 'Betalsätt',
      followUs: 'Följ oss:',
      securePayment: 'Säker betalning med SSL',
      freeShipping: `Fri frakt över ${storeConfig.shipping.freeShippingThreshold} kr`,
      founded: 'Grundat 2026',
      responseTime: 'Svar inom 48 timmar',
      europeanDelivery: 'Leverans i Europa',
      privacyPolicy: 'Integritetspolicy',
      terms: 'Villkor',
      returns: 'Returer'
    },
    en: {
      quickLinks: 'Quick Links',
      customerService: 'Customer Service',
      payment: 'Payment',
      followUs: 'Follow us:',
      securePayment: 'Secure SSL payment',
      freeShipping: `Free shipping over ${storeConfig.shipping.freeShippingThreshold} SEK`,
      founded: 'Founded 2026',
      responseTime: 'Response within 48 hours',
      europeanDelivery: 'European delivery',
      privacyPolicy: 'Privacy Policy',
      terms: 'Terms',
      returns: 'Returns'
    },
    no: {
      quickLinks: 'Hurtiglenker',
      customerService: 'Kundeservice',
      payment: 'Betaling',
      followUs: 'Følg oss:',
      securePayment: 'Sikker betaling med SSL',
      freeShipping: `Fri frakt over ${storeConfig.shipping.freeShippingThreshold} kr`,
      founded: 'Grunnlagt 2026',
      responseTime: 'Svar innen 48 timer',
      europeanDelivery: 'Europeisk levering',
      privacyPolicy: 'Personvernerklæring',
      terms: 'Vilkår',
      returns: 'Returer'
    },
    da: {
      quickLinks: 'Hurtige links',
      customerService: 'Kundeservice',
      payment: 'Betaling',
      followUs: 'Følg os:',
      securePayment: 'Sikker betaling med SSL',
      freeShipping: `Gratis fragt over ${storeConfig.shipping.freeShippingThreshold} kr`,
      founded: 'Grundlagt 2026',
      responseTime: 'Svar inden for 48 timer',
      europeanDelivery: 'Europæisk levering',
      privacyPolicy: 'Privatlivspolitik',
      terms: 'Vilkår',
      returns: 'Returneringer'
    },
    de: {
      quickLinks: 'Schnelllinks',
      customerService: 'Kundenservice',
      payment: 'Zahlung',
      followUs: 'Folgen Sie uns:',
      securePayment: 'Sichere SSL-Zahlung',
      freeShipping: `Kostenloser Versand ab ${storeConfig.shipping.freeShippingThreshold} SEK`,
      founded: 'Gegründet 2026',
      responseTime: 'Antwort innerhalb von 48 Stunden',
      europeanDelivery: 'Europäische Lieferung',
      privacyPolicy: 'Datenschutz',
      terms: 'AGB',
      returns: 'Rückgabe'
    }
  };

  const fc = footerContent[language as keyof typeof footerContent] || footerContent.en;

  const quickLinks = [
    { href: '/shop', label: language === 'sv' ? 'Alla produkter' : language === 'no' ? 'Alle produkter' : language === 'da' ? 'Alle produkter' : language === 'de' ? 'Alle Produkte' : 'All Products' },
    { href: '/about', label: t('nav.about') },
    { href: '/how-it-works', label: language === 'sv' ? 'Så funkar det' : language === 'no' ? 'Slik fungerer det' : language === 'da' ? 'Sådan fungerer det' : language === 'de' ? 'So funktioniert es' : 'How It Works' },
    { href: '/contact', label: t('nav.contact') },
    { href: '/track-order', label: language === 'sv' ? 'Spåra order' : language === 'no' ? 'Spor ordre' : language === 'da' ? 'Spor ordre' : language === 'de' ? 'Bestellung verfolgen' : 'Track Order' },
    { href: '/business', label: language === 'sv' ? 'Företagskunder' : language === 'no' ? 'Bedriftskunder' : language === 'da' ? 'Erhvervskunder' : language === 'de' ? 'Geschäftskunden' : 'Business Customers' },
    { href: '/affiliate', label: language === 'sv' ? 'Samarbete' : language === 'no' ? 'Samarbeid' : language === 'da' ? 'Samarbejde' : language === 'de' ? 'Partnerschaft' : 'Partnership' },
    { href: '/suggest-product', label: language === 'sv' ? 'Önska produkt' : language === 'no' ? 'Ønsk produkt' : language === 'da' ? 'Ønsk produkt' : language === 'de' ? 'Produkt wünschen' : 'Suggest Product' },
  ];

  const customerServiceLinks = [
    { href: '/policies/shipping', label: t('footer.shippinginfo') },
    { href: '/policies/returns', label: t('footer.returns') },
    { href: '/policies/privacy', label: fc.privacyPolicy },
    { href: '/policies/terms', label: fc.terms },
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
            
            {/* Contact info */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground mb-6">
              <span className="flex items-center gap-1.5">
                <Mail className="w-4 h-4 text-primary" />
                {storeConfig.contact.email}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-primary" />
                {fc.responseTime}
              </span>
              <span className="flex items-center gap-1.5">
                🌍 {fc.europeanDelivery}
              </span>
            </div>
            
            {/* Social links */}
            <div className="space-y-3">
              <p className="text-sm font-medium">{fc.followUs}</p>
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
            <h4 className="font-display font-semibold text-lg mb-5">{fc.quickLinks}</h4>
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
            <h4 className="font-display font-semibold text-lg mb-5">{fc.customerService}</h4>
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
            <h4 className="font-display font-semibold text-lg mb-5">{fc.payment}</h4>
            <div className="space-y-4">
              <PaymentIcons />
              <p className="text-sm text-muted-foreground">
                🔒 {fc.securePayment}
              </p>
              <p className="text-sm text-primary font-medium">
                {fc.freeShipping}
              </p>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="decorative-line mt-12 mb-8" />
        
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-3">
            <p>© {new Date().getFullYear()} {storeConfig.company.name}. {t('footer.rights')}</p>
            <span className="text-xs opacity-60">{fc.founded}</span>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/policies/privacy" className="hover:text-foreground transition-colors">
              {fc.privacyPolicy}
            </Link>
            <Link to="/policies/terms" className="hover:text-foreground transition-colors">
              {fc.terms}
            </Link>
            <Link to="/policies/returns" className="hover:text-foreground transition-colors">
              {fc.returns}
            </Link>
            <LanguageSwitcher />
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
