import { Leaf, Mail, Phone, MapPin } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

const Footer = () => {
  const { t } = useLanguage();
  
  return (
    <footer id="contact" className="bg-card border-t border-border">
      <div className="container mx-auto px-4 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-12">
          {/* Brand */}
          <div className="md:col-span-1">
            <a href="/" className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center">
                <Leaf className="w-6 h-6 text-primary-foreground" />
              </div>
              <span className="font-display text-xl font-bold">
                4the<span className="text-gradient">people</span>
              </span>
            </a>
            <p className="text-muted-foreground text-sm">
              {t('footer.description')}
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-display font-semibold mb-4">{t('footer.quicklinks')}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#products" className="hover:text-foreground transition-colors">{t('nav.products')}</a></li>
              <li><a href="#about" className="hover:text-foreground transition-colors">{t('nav.about')}</a></li>
              <li><a href="#faq" className="hover:text-foreground transition-colors">{t('footer.faq')}</a></li>
              <li><a href="#contact" className="hover:text-foreground transition-colors">{t('footer.customerservice')}</a></li>
            </ul>
          </div>

          {/* Customer Service */}
          <div>
            <h4 className="font-display font-semibold mb-4">{t('footer.customerservice')}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-foreground transition-colors">{t('footer.shippinginfo')}</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">{t('footer.returns')}</a></li>
              <li><a href="#faq" className="hover:text-foreground transition-colors">{t('footer.faq')}</a></li>
              <li><a href="#contact" className="hover:text-foreground transition-colors">{t('footer.contact')}</a></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-display font-semibold mb-4">{t('footer.contact')}</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-primary" />
                <a href="mailto:hej@4thepeople.se" className="hover:text-foreground transition-colors">
                  hej@4thepeople.se
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-primary" />
                <a href="tel:+46701234567" className="hover:text-foreground transition-colors">
                  070-123 45 67
                </a>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-primary mt-0.5" />
                <span>Naturvägen 1<br />123 45 Stockholm</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>© 2026 4thepeople. {t('footer.rights')}</p>
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-foreground transition-colors">Terms</a>
            <a href="#" className="hover:text-foreground transition-colors">Cookies</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
