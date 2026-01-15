import React, { createContext, useContext, useState, ReactNode } from 'react';

export type Language = 'sv' | 'en';

interface Translations {
  [key: string]: {
    sv: string;
    en: string;
  };
}

export const translations: Translations = {
  // Navigation
  'nav.products': { sv: 'Produkter', en: 'Products' },
  'nav.about': { sv: 'Om oss', en: 'About' },
  'nav.contact': { sv: 'Kontakt', en: 'Contact' },
  
  // Hero - Professional & Honest
  'hero.badge': { sv: 'Svensk Startup 2024', en: 'Swedish Startup 2024' },
  'hero.title': { sv: 'Giftfria Produkter för Sverige', en: 'Toxin-Free Products for Sweden' },
  'hero.subtitle': { sv: 'Vi är inte det största företaget. Vi är det noggrannaste. Varje produkt vi säljer är testad och godkänd av oss själva. Inga mirakel. Inga överdrivna löften. Bara ärliga produkter till ärliga priser.', en: "We're not the biggest company. We're the most careful. Every product we sell is tested and approved by us. No miracles. No exaggerated promises. Just honest products at honest prices." },
  'hero.cta.products': { sv: 'Shoppa nu', en: 'Shop now' },
  'hero.cta.contact': { sv: 'Läs mer om oss', en: 'Read more about us' },
  'hero.feature.toxinfree': { sv: 'Noggrant utvalt', en: 'Carefully selected' },
  'hero.feature.quality': { sv: '30 dagars öppet köp', en: '30-day returns' },
  'hero.feature.shipping': { sv: 'Snabb leverans', en: 'Fast delivery' },
  'hero.feature.service': { sv: 'Personlig kundservice', en: 'Personal service' },

  // Products
  'products.title': { sv: 'Våra Produkter', en: 'Our Products' },
  'products.addtocart': { sv: 'Lägg i varukorg', en: 'Add to cart' },
  'products.viewdetails': { sv: 'Visa detaljer', en: 'View details' },
  'products.noproducts': { sv: 'Inga produkter hittades', en: 'No products found' },
  'products.loading': { sv: 'Laddar produkter...', en: 'Loading products...' },
  'products.error': { sv: 'Kunde inte ladda produkter', en: 'Failed to load products' },
  
  // About
  'about.title': { sv: 'Varför välja', en: 'Why choose' },
  'about.description1': { sv: 'Vi tror på att leva rent - både för din kropp och för planeten. Våra produkter är noggrant utvalda för att vara fria från skadliga kemikalier och tillverkade med respekt för miljön.', en: 'We believe in living clean - both for your body and for the planet. Our products are carefully selected to be free from harmful chemicals and made with respect for the environment.' },
  'about.description2': { sv: 'Från naturliga kroppsvårdsprodukter som tvål, tandkräm och schampo, till hållbar teknik och giftfria kläder - vi erbjuder allt du behöver för ett renare och hälsosammare liv.', en: 'From natural body care products like soap, toothpaste and shampoo, to sustainable tech and toxin-free clothing - we offer everything you need for a cleaner and healthier life.' },
  'about.stat.customers': { sv: 'Nöjda kunder', en: 'Happy customers' },
  'about.stat.natural': { sv: 'Naturligt', en: 'Natural' },
  'about.stat.toxinfree': { sv: 'Alla produkter', en: 'All products' },
  'about.stat.service': { sv: 'Personlig service', en: 'Personal service' },
  'about.visual.title': { sv: 'Naturligt & Hållbart', en: 'Natural & Sustainable' },
  'about.visual.description': { sv: 'Alla våra produkter är noggrant utvalda för att vara giftfria och miljövänliga', en: 'All our products are carefully selected to be toxin-free and eco-friendly' },
  
  // Footer
  'footer.description': { sv: 'Din destination för giftfria produkter och hållbar teknik. Lev rent, lev bättre.', en: 'Your destination for toxin-free products and sustainable tech. Live clean, live better.' },
  'footer.quicklinks': { sv: 'Snabblänkar', en: 'Quick Links' },
  'footer.customerservice': { sv: 'Kundtjänst', en: 'Customer Service' },
  'footer.shippinginfo': { sv: 'Fraktinformation', en: 'Shipping Info' },
  'footer.returns': { sv: 'Byten & Returer', en: 'Returns & Exchanges' },
  'footer.faq': { sv: 'Vanliga frågor', en: 'FAQ' },
  'footer.contact': { sv: 'Kontakt', en: 'Contact' },
  'footer.rights': { sv: 'Alla rättigheter förbehållna.', en: 'All rights reserved.' },
  
  // Cart
  'cart.title': { sv: 'Varukorg', en: 'Shopping Cart' },
  'cart.empty': { sv: 'Din varukorg är tom', en: 'Your cart is empty' },
  'cart.items': { sv: 'artiklar i varukorgen', en: 'items in your cart' },
  'cart.total': { sv: 'Totalt', en: 'Total' },
  'cart.checkout': { sv: 'Gå till kassan', en: 'Proceed to checkout' },
  'cart.creating': { sv: 'Skapar kassa...', en: 'Creating checkout...' },
  'cart.added': { sv: 'Tillagd i varukorgen', en: 'Added to cart' },
  
  // Product Detail
  'product.quantity': { sv: 'Antal', en: 'Quantity' },
  'product.outofstock': { sv: 'Slut i lager', en: 'Out of stock' },
  'product.back': { sv: 'Tillbaka', en: 'Back' },
  'product.notfound': { sv: 'Produkten hittades inte', en: 'Product not found' },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguage] = useState<Language>('sv');

  const t = (key: string): string => {
    const translation = translations[key];
    if (!translation) {
      console.warn(`Missing translation for key: ${key}`);
      return key;
    }
    return translation[language];
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
