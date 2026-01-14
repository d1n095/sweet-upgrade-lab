import { Link } from 'react-router-dom';
import { Leaf, Mail, Phone, MapPin, Instagram, Facebook, Twitter, CreditCard, Wallet } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { storeConfig } from '@/config/storeConfig';

const Footer = () => {
  const { t, language } = useLanguage();
  
  const socialLinks = [
    { icon: Instagram, href: storeConfig.social.instagram, label: 'Instagram' },
    { icon: Facebook, href: storeConfig.social.facebook, label: 'Facebook' },
    { icon: Twitter, href: storeConfig.social.twitter, label: 'Twitter' },
  ];

  const quickLinks = [
    { href: '/shop', label: language === 'sv' ? 'Alla produkter' : 'All Products' },
    { href: '/about', label: t('nav.about') },
    { href: '/how-it-works', label: language === 'sv' ? 'Så funkar det' : 'How It Works' },
    { href: '/contact', label: t('nav.contact') },
    { href: '/track-order', label: language === 'sv' ? 'Spåra order' : 'Track Order' },
  ];

  const customerServiceLinks = [
    { href: '/policies/shipping', label: t('footer.shippinginfo') },
    { href: '/policies/returns', label: t('footer.returns') },
    { href: '/policies/privacy', label: language === 'sv' ? 'Integritetspolicy' : 'Privacy Policy' },
    { href: '/policies/terms', label: language === 'sv' ? 'Villkor' : 'Terms & Conditions' },
  ];
  
  return (
    <footer className="bg-card border-t border-border/50 relative overflow-hidden">
      {/* Decorative elements */}
      <div className="decorative-circle w-[400px] h-[400px] bg-primary/3 -top-48 -right-48" />
      <div className="decorative-circle w-[300px] h-[300px] bg-accent/3 -bottom-32 -left-32" />
      
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
            
            {/* Social links */}
            <div className="flex items-center gap-3">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  className="w-10 h-10 rounded-xl bg-secondary/50 hover:bg-primary/10 flex items-center justify-center text-muted-foreground hover:text-primary transition-all duration-200"
                >
                  <social.icon className="w-5 h-5" />
                </a>
              ))}
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

          {/* Contact */}
          <div>
            <h4 className="font-display font-semibold text-lg mb-5">{t('footer.contact')}</h4>
            <ul className="space-y-4 text-sm">
              <li className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Mail className="w-4 h-4 text-primary" />
                </div>
                <a href={`mailto:${storeConfig.contact.email}`} className="text-muted-foreground hover:text-foreground transition-colors">
                  {storeConfig.contact.email}
                </a>
              </li>
              <li className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Phone className="w-4 h-4 text-primary" />
                </div>
                <a href={`tel:${storeConfig.contact.phone}`} className="text-muted-foreground hover:text-foreground transition-colors">
                  {storeConfig.contact.phoneFormatted}
                </a>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-4 h-4 text-primary" />
                </div>
                <span className="text-muted-foreground">
                  {storeConfig.contact.address.street}<br />
                  {storeConfig.contact.address.zip} {storeConfig.contact.address.city}
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="mt-12 pt-8 border-t border-border/50">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="text-sm">{language === 'sv' ? 'Betalningsmetoder:' : 'Payment methods:'}</span>
              <div className="flex items-center gap-3 ml-2">
                <CreditCard className="w-6 h-6" />
                <Wallet className="w-6 h-6" />
                <span className="text-xs font-medium px-2 py-1 bg-secondary rounded">Swish</span>
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              {language === 'sv' ? `Fri frakt över ${storeConfig.shipping.freeShippingThreshold} kr` : `Free shipping over ${storeConfig.shipping.freeShippingThreshold} SEK`}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="decorative-line mt-8 mb-8" />
        
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} {storeConfig.company.name}. {t('footer.rights')}</p>
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
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;