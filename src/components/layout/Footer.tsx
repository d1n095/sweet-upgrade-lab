import { Zap, Mail, Phone, MapPin } from 'lucide-react';

const Footer = () => {
  return (
    <footer id="contact" className="bg-card border-t border-border">
      <div className="container mx-auto px-4 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-12">
          {/* Brand */}
          <div className="md:col-span-1">
            <a href="/" className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center">
                <Zap className="w-6 h-6 text-primary-foreground" />
              </div>
              <span className="font-display text-xl font-bold">
                Charger<span className="text-gradient">Shop</span>
              </span>
            </a>
            <p className="text-muted-foreground text-sm">
              Sveriges ledande leverantör av laddlösningar för elbilar. Kvalitet och service i fokus.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-display font-semibold mb-4">Snabblänkar</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#products" className="hover:text-foreground transition-colors">Produkter</a></li>
              <li><a href="#about" className="hover:text-foreground transition-colors">Om oss</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Installation</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Support</a></li>
            </ul>
          </div>

          {/* Products */}
          <div>
            <h4 className="font-display font-semibold mb-4">Produkter</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-foreground transition-colors">Wallboxar</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">EV-laddare</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Portabla laddare</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Tillbehör</a></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-display font-semibold mb-4">Kontakt</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-primary" />
                <a href="mailto:info@chargershop.se" className="hover:text-foreground transition-colors">
                  info@chargershop.se
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
                <span>Teknikvägen 1<br />123 45 Stockholm</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>© 2026 ChargerShop. Alla rättigheter reserverade.</p>
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-foreground transition-colors">Integritetspolicy</a>
            <a href="#" className="hover:text-foreground transition-colors">Villkor</a>
            <a href="#" className="hover:text-foreground transition-colors">Cookies</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
