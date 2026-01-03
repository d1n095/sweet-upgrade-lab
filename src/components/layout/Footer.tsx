import { Leaf, Mail, Phone, MapPin } from 'lucide-react';

const Footer = () => {
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
                Pure<span className="text-gradient">Life</span>
              </span>
            </a>
            <p className="text-muted-foreground text-sm">
              Giftfria produkter för ett renare och hälsosammare liv. Naturliga kroppsvårdsprodukter, hållbar teknik och ekologiska kläder.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-display font-semibold mb-4">Snabblänkar</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#products" className="hover:text-foreground transition-colors">Produkter</a></li>
              <li><a href="#about" className="hover:text-foreground transition-colors">Om oss</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Våra värderingar</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Kundtjänst</a></li>
            </ul>
          </div>

          {/* Products */}
          <div>
            <h4 className="font-display font-semibold mb-4">Kategorier</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-foreground transition-colors">Kroppsvård</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Teknikprodukter</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Kläder</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Tillbehör</a></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-display font-semibold mb-4">Kontakt</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-primary" />
                <a href="mailto:hej@purelife.se" className="hover:text-foreground transition-colors">
                  hej@purelife.se
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
          <p>© 2026 PureLife. Alla rättigheter reserverade.</p>
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
