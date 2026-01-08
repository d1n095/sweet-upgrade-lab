import { Leaf, Mail, Phone, MapPin, Instagram, Facebook, Twitter } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { motion } from 'framer-motion';

const Footer = () => {
  const { t, language } = useLanguage();
  
  const socialLinks = [
    { icon: Instagram, href: '#', label: 'Instagram' },
    { icon: Facebook, href: '#', label: 'Facebook' },
    { icon: Twitter, href: '#', label: 'Twitter' },
  ];
  
  return (
    <footer id="contact" className="bg-card border-t border-border/50 relative overflow-hidden">
      {/* Decorative elements */}
      <div className="decorative-circle w-[400px] h-[400px] bg-primary/3 -top-48 -right-48" />
      <div className="decorative-circle w-[300px] h-[300px] bg-accent/3 -bottom-32 -left-32" />
      
      <div className="container mx-auto px-4 py-16 md:py-20 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 md:gap-12">
          {/* Brand */}
          <div className="lg:col-span-1">
            <a href="/" className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 rounded-xl bg-gradient-accent flex items-center justify-center">
                <Leaf className="w-6 h-6 text-accent-foreground" />
              </div>
              <span className="font-display text-xl font-semibold">
                4the<span className="text-gradient">people</span>
              </span>
            </a>
            <p className="text-muted-foreground text-sm leading-relaxed mb-6">
              {t('footer.description')}
            </p>
            
            {/* Social links */}
            <div className="flex items-center gap-3">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
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
              <li><a href="#products" className="text-muted-foreground hover:text-foreground transition-colors">{t('nav.products')}</a></li>
              <li><a href="#about" className="text-muted-foreground hover:text-foreground transition-colors">{t('nav.about')}</a></li>
              <li><a href="#faq" className="text-muted-foreground hover:text-foreground transition-colors">{t('footer.faq')}</a></li>
              <li><a href="#contact" className="text-muted-foreground hover:text-foreground transition-colors">{t('footer.customerservice')}</a></li>
            </ul>
          </div>

          {/* Customer Service */}
          <div>
            <h4 className="font-display font-semibold text-lg mb-5">{t('footer.customerservice')}</h4>
            <ul className="space-y-3 text-sm">
              <li><a href="#" className="text-muted-foreground hover:text-foreground transition-colors">{t('footer.shippinginfo')}</a></li>
              <li><a href="#" className="text-muted-foreground hover:text-foreground transition-colors">{t('footer.returns')}</a></li>
              <li><a href="#faq" className="text-muted-foreground hover:text-foreground transition-colors">{t('footer.faq')}</a></li>
              <li><a href="#contact" className="text-muted-foreground hover:text-foreground transition-colors">{t('footer.contact')}</a></li>
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
                <a href="mailto:hej@4thepeople.se" className="text-muted-foreground hover:text-foreground transition-colors">
                  hej@4thepeople.se
                </a>
              </li>
              <li className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Phone className="w-4 h-4 text-primary" />
                </div>
                <a href="tel:+46701234567" className="text-muted-foreground hover:text-foreground transition-colors">
                  070-123 45 67
                </a>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-4 h-4 text-primary" />
                </div>
                <span className="text-muted-foreground">Naturvägen 1<br />123 45 Stockholm</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="decorative-line mt-12 mb-8" />
        
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>© 2026 4thepeople. {t('footer.rights')}</p>
          <div className="flex items-center gap-8">
            <a href="#" className="hover:text-foreground transition-colors">{language === 'sv' ? 'Integritetspolicy' : 'Privacy Policy'}</a>
            <a href="#" className="hover:text-foreground transition-colors">{language === 'sv' ? 'Villkor' : 'Terms'}</a>
            <a href="#" className="hover:text-foreground transition-colors">Cookies</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;