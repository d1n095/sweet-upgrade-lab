import { Link } from 'react-router-dom';
import { Leaf, Mail, Clock, Instagram, Facebook, Send } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { storeConfig } from '@/config/storeConfig';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import PaymentIcons from '@/components/trust/PaymentIcons';
import { usePageVisibility } from '@/stores/pageVisibilityStore';

const Footer = () => {
  const { t } = useLanguage();
  const { isVisible } = usePageVisibility();
  
  const quickLinks = [
    { href: '/shop', label: t('nav.products') },
    { href: '/about', label: t('nav.about') },
    { href: '/contact', label: t('nav.contact') },
    { href: '/track-order', label: t('nav.trackorder') },
    ...(isVisible('affiliate') ? [{ href: '/affiliate', label: t('nav.partnership') }] : []),
  ];

  const legalLinks = [
    { href: '/policies/shipping', label: t('footer.shippinginfo') },
    { href: '/policies/returns', label: t('footer.returns') },
    { href: '/policies/privacy', label: t('footer.privacypolicy') },
    { href: '/policies/terms', label: t('footer.terms') },
  ];
  
  return (
    <footer className="border-t border-border/50">
      <div className="container mx-auto px-4 py-12 md:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-accent flex items-center justify-center">
                <Leaf className="w-4 h-4 text-accent-foreground" />
              </div>
              <span className="text-base font-bold">
                4The<span className="text-gradient">People</span>
              </span>
            </Link>
            <p className="text-xs text-muted-foreground leading-relaxed mb-4 max-w-[200px]">
              {t('footer.description')}
            </p>
            <div className="flex items-center gap-2">
              <a href={storeConfig.social.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram"
                className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                <Instagram className="w-4 h-4" />
              </a>
              <a href={storeConfig.social.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook"
                className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                <Facebook className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider mb-4">{t('footer.quicklinks')}</h4>
            <ul className="space-y-2">
              {quickLinks.map((link) => (
                <li key={link.href}>
                  <Link to={link.href} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider mb-4">{t('footer.customerservice')}</h4>
            <ul className="space-y-2">
              {legalLinks.map((link) => (
                <li key={link.href}>
                  <Link to={link.href} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Payment & Contact */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider mb-4">{t('footer.payment')}</h4>
            <div className="space-y-3">
              <PaymentIcons />
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Mail className="w-3 h-3" />
                {storeConfig.contact.email}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                {t('footer.response')}
              </div>
            </div>
          </div>
        </div>

        <div className="decorative-line mt-10 mb-6" />
        
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 text-[11px] text-muted-foreground">
          <p>© {new Date().getFullYear()} {storeConfig.company.name}. {t('footer.rights')}</p>
          <div className="flex items-center gap-4">
            <Link to="/policies/privacy" className="hover:text-foreground transition-colors">{t('footer.privacypolicy')}</Link>
            <Link to="/policies/terms" className="hover:text-foreground transition-colors">{t('footer.terms')}</Link>
            <LanguageSwitcher />
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
