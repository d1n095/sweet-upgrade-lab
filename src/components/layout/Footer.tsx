import { Link } from 'react-router-dom';
import { Leaf, Mail, Clock, Instagram, Facebook } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { storeConfig } from '@/config/storeConfig';
import PaymentIcons from '@/components/trust/PaymentIcons';
import { usePageVisibility } from '@/stores/pageVisibilityStore';

const Footer = () => {
  const { t } = useLanguage();
  const { isVisible } = usePageVisibility();
  
  const quickLinks = [
    { href: '/produkter', label: t('nav.products') },
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
    <footer className="border-t border-border/40">
      <div className="container mx-auto px-4 py-14 md:py-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-12 md:gap-20">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="flex items-center gap-2.5 mb-5">
              <div className="w-8 h-8 rounded-lg bg-gradient-accent flex items-center justify-center">
                <Leaf className="w-4 h-4 text-accent-foreground" />
              </div>
              <span className="text-base font-semibold">
                4The<span className="text-gradient">People</span>
              </span>
            </Link>
            <p className="text-[11px] text-muted-foreground/80 leading-[1.7] mb-5 max-w-[200px]">
              {t('footer.description')}
            </p>
            <div className="flex items-center gap-3">
              <a href={storeConfig.social.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram"
                className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-all min-h-[44px] min-w-[44px]">
                <Instagram className="w-5 h-5" />
              </a>
              <a href={storeConfig.social.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook"
                className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-all min-h-[44px] min-w-[44px]">
                <Facebook className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-foreground/80 mb-5">{t('footer.quicklinks')}</h4>
            <ul className="space-y-2.5">
              {quickLinks.map((link) => (
                <li key={link.href}>
                  <Link to={link.href} className="text-[11px] text-muted-foreground/80 hover:text-foreground transition-colors min-h-[44px] flex items-center">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-foreground/80 mb-5">{t('footer.customerservice')}</h4>
            <ul className="space-y-2.5">
              {legalLinks.map((link) => (
                <li key={link.href}>
                  <Link to={link.href} className="text-[11px] text-muted-foreground/80 hover:text-foreground transition-colors min-h-[44px] flex items-center">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Payment & Contact */}
          <div>
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-foreground/80 mb-5">{t('footer.payment')}</h4>
            <div className="space-y-3.5">
              <PaymentIcons />
              <a href={`mailto:${storeConfig.contact.email}`} className="flex items-center gap-2 text-[11px] text-muted-foreground/80 hover:text-foreground transition-colors">
                <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                {storeConfig.contact.email}
              </a>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground/80">
                <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                {t('footer.response')}
              </div>
            </div>
          </div>
        </div>

        <div className="decorative-line mt-12 mb-8" />
        
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-[10px] text-muted-foreground/60">
          <p>© {new Date().getFullYear()} {storeConfig.company.name}. All rights reserved.</p>
          <div className="flex items-center gap-5">
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
