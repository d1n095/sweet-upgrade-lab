import React, { createContext, useContext, useState, ReactNode } from 'react';

export type Language = 'sv' | 'en' | 'no' | 'da' | 'de' | 'fi' | 'nl' | 'fr' | 'es' | 'pl';

interface TranslationEntry {
  sv: string;
  en: string;
  no?: string;
  da?: string;
  de?: string;
  fi?: string;
  nl?: string;
  fr?: string;
  es?: string;
  pl?: string;
}

interface Translations {
  [key: string]: TranslationEntry;
}

export const translations: Translations = {
  // Navigation
  'nav.products': { sv: 'Produkter', en: 'Products', no: 'Produkter', da: 'Produkter', de: 'Produkte' },
  'nav.about': { sv: 'Om oss', en: 'About', no: 'Om oss', da: 'Om os', de: 'Über uns' },
  'nav.contact': { sv: 'Kontakt', en: 'Contact', no: 'Kontakt', da: 'Kontakt', de: 'Kontakt' },
  
  // Hero - Professional & Honest
  'hero.badge': { sv: 'Europeisk Startup 2026', en: 'European Startup 2026', no: 'Europeisk Startup 2026', da: 'Europæisk Startup 2026', de: 'Europäisches Startup 2026' },
  'hero.title': { sv: 'Giftfria Produkter för Europa', en: 'Toxin-Free Products for Europe', no: 'Giftfrie Produkter for Europa', da: 'Giftfrie Produkter til Europa', de: 'Schadstofffreie Produkte für Europa' },
  'hero.subtitle': { sv: 'Vi är inte det största företaget. Vi är det noggrannaste. Varje produkt vi säljer är testad och godkänd av oss själva. Inga mirakel. Inga överdrivna löften. Bara ärliga produkter till ärliga priser.', en: "We're not the biggest company. We're the most careful. Every product we sell is tested and approved by us. No miracles. No exaggerated promises. Just honest products at honest prices.", no: 'Vi er ikke det største selskapet. Vi er det mest nøye. Hver produkt vi selger er testet og godkjent av oss selv. Ingen mirakler. Ingen overdrevne løfter. Bare ærlige produkter til ærlige priser.', da: 'Vi er ikke den største virksomhed. Vi er den mest omhyggelige. Hvert produkt vi sælger er testet og godkendt af os selv. Ingen mirakler. Ingen overdrevne løfter. Bare ærlige produkter til ærlige priser.', de: 'Wir sind nicht das größte Unternehmen. Wir sind das sorgfältigste. Jedes Produkt, das wir verkaufen, wurde von uns selbst getestet und genehmigt. Keine Wunder. Keine übertriebenen Versprechen. Nur ehrliche Produkte zu ehrlichen Preisen.' },
  'hero.cta.products': { sv: 'Shoppa nu', en: 'Shop now', no: 'Handle nå', da: 'Shop nu', de: 'Jetzt kaufen' },
  'hero.cta.contact': { sv: 'Läs mer om oss', en: 'Read more about us', no: 'Les mer om oss', da: 'Læs mere om os', de: 'Mehr über uns' },
  'hero.feature.toxinfree': { sv: 'Noggrant utvalt', en: 'Carefully selected', no: 'Nøye utvalgt', da: 'Omhyggeligt udvalgt', de: 'Sorgfältig ausgewählt' },
  'hero.feature.quality': { sv: '30 dagars öppet köp', en: '30-day returns', no: '30 dagers åpent kjøp', da: '30 dages returret', de: '30 Tage Rückgaberecht' },
  'hero.feature.shipping': { sv: 'Snabb leverans', en: 'Fast delivery', no: 'Rask levering', da: 'Hurtig levering', de: 'Schnelle Lieferung' },
  'hero.feature.service': { sv: 'Personlig kundservice', en: 'Personal service', no: 'Personlig kundeservice', da: 'Personlig kundeservice', de: 'Persönlicher Service' },

  // Products
  'products.title': { sv: 'Våra Produkter', en: 'Our Products', no: 'Våre Produkter', da: 'Vores Produkter', de: 'Unsere Produkte' },
  'products.addtocart': { sv: 'Lägg i varukorg', en: 'Add to cart', no: 'Legg i handlekurv', da: 'Læg i kurv', de: 'In den Warenkorb' },
  'products.viewdetails': { sv: 'Visa detaljer', en: 'View details', no: 'Se detaljer', da: 'Se detaljer', de: 'Details anzeigen' },
  'products.noproducts': { sv: 'Inga produkter hittades', en: 'No products found', no: 'Ingen produkter funnet', da: 'Ingen produkter fundet', de: 'Keine Produkte gefunden' },
  'products.loading': { sv: 'Laddar produkter...', en: 'Loading products...', no: 'Laster produkter...', da: 'Indlæser produkter...', de: 'Produkte werden geladen...' },
  'products.error': { sv: 'Kunde inte ladda produkter', en: 'Failed to load products', no: 'Kunne ikke laste produkter', da: 'Kunne ikke indlæse produkter', de: 'Produkte konnten nicht geladen werden' },
  
  // About
  'about.title': { sv: 'Varför välja', en: 'Why choose', no: 'Hvorfor velge', da: 'Hvorfor vælge', de: 'Warum wählen' },
  'about.description1': { sv: 'Vi tror på att leva rent - både för din kropp och för planeten. Våra produkter är noggrant utvalda för att vara fria från skadliga kemikalier och tillverkade med respekt för miljön.', en: 'We believe in living clean - both for your body and for the planet. Our products are carefully selected to be free from harmful chemicals and made with respect for the environment.', no: 'Vi tror på å leve rent - både for kroppen din og for planeten. Våre produkter er nøye utvalgt for å være fri for skadelige kjemikalier og laget med respekt for miljøet.', da: 'Vi tror på at leve rent - både for din krop og for planeten. Vores produkter er omhyggeligt udvalgt for at være fri for skadelige kemikalier og lavet med respekt for miljøet.', de: 'Wir glauben an ein sauberes Leben - sowohl für Ihren Körper als auch für den Planeten. Unsere Produkte sind sorgfältig ausgewählt, um frei von schädlichen Chemikalien zu sein und mit Respekt für die Umwelt hergestellt.' },
  'about.description2': { sv: 'Från naturliga kroppsvårdsprodukter som tvål, tandkräm och schampo, till hållbar teknik och giftfria kläder - vi erbjuder allt du behöver för ett renare och hälsosammare liv.', en: 'From natural body care products like soap, toothpaste and shampoo, to sustainable tech and toxin-free clothing - we offer everything you need for a cleaner and healthier life.', no: 'Fra naturlige kroppsprodukter som såpe, tannkrem og sjampo, til bærekraftig teknologi og giftfrie klær - vi tilbyr alt du trenger for et renere og sunnere liv.', da: 'Fra naturlige kropspleje produkter som sæbe, tandpasta og shampoo, til bæredygtig teknologi og giftfrit tøj - vi tilbyder alt hvad du behøver for et renere og sundere liv.', de: 'Von natürlichen Körperpflegeprodukten wie Seife, Zahnpasta und Shampoo bis hin zu nachhaltiger Technologie und schadstofffreier Kleidung - wir bieten alles, was Sie für ein saubereres und gesünderes Leben brauchen.' },
  'about.stat.customers': { sv: 'Nöjda kunder', en: 'Happy customers', no: 'Fornøyde kunder', da: 'Tilfredse kunder', de: 'Zufriedene Kunden' },
  'about.stat.natural': { sv: 'Naturligt', en: 'Natural', no: 'Naturlig', da: 'Naturligt', de: 'Natürlich' },
  'about.stat.toxinfree': { sv: 'Alla produkter', en: 'All products', no: 'Alle produkter', da: 'Alle produkter', de: 'Alle Produkte' },
  'about.stat.service': { sv: 'Personlig service', en: 'Personal service', no: 'Personlig service', da: 'Personlig service', de: 'Persönlicher Service' },
  'about.visual.title': { sv: 'Naturligt & Hållbart', en: 'Natural & Sustainable', no: 'Naturlig & Bærekraftig', da: 'Naturligt & Bæredygtigt', de: 'Natürlich & Nachhaltig' },
  'about.visual.description': { sv: 'Alla våra produkter är noggrant utvalda för att vara giftfria och miljövänliga', en: 'All our products are carefully selected to be toxin-free and eco-friendly', no: 'Alle våre produkter er nøye utvalgt for å være giftfrie og miljøvennlige', da: 'Alle vores produkter er omhyggeligt udvalgt for at være giftfrie og miljøvenlige', de: 'Alle unsere Produkte sind sorgfältig ausgewählt, um schadstofffrei und umweltfreundlich zu sein' },
  
  // Footer
  'footer.description': { sv: 'Din destination för giftfria produkter och hållbar teknik. Lev rent, lev bättre.', en: 'Your destination for toxin-free products and sustainable tech. Live clean, live better.', no: 'Din destinasjon for giftfrie produkter og bærekraftig teknologi. Lev rent, lev bedre.', da: 'Din destination for giftfrie produkter og bæredygtig teknologi. Lev rent, lev bedre.', de: 'Ihr Ziel für schadstofffreie Produkte und nachhaltige Technologie. Sauber leben, besser leben.' },
  'footer.quicklinks': { sv: 'Snabblänkar', en: 'Quick Links', no: 'Hurtiglenker', da: 'Hurtige links', de: 'Schnelllinks' },
  'footer.customerservice': { sv: 'Kundtjänst', en: 'Customer Service', no: 'Kundeservice', da: 'Kundeservice', de: 'Kundenservice' },
  'footer.shippinginfo': { sv: 'Fraktinformation', en: 'Shipping Info', no: 'Fraktinformasjon', da: 'Fragtinformation', de: 'Versandinfo' },
  'footer.returns': { sv: 'Byten & Returer', en: 'Returns & Exchanges', no: 'Bytte & Retur', da: 'Bytte & Retur', de: 'Umtausch & Rückgabe' },
  'footer.faq': { sv: 'Vanliga frågor', en: 'FAQ', no: 'Vanlige spørsmål', da: 'Ofte stillede spørgsmål', de: 'Häufige Fragen' },
  'footer.contact': { sv: 'Kontakt', en: 'Contact', no: 'Kontakt', da: 'Kontakt', de: 'Kontakt' },
  'footer.rights': { sv: 'Alla rättigheter förbehållna.', en: 'All rights reserved.', no: 'Alle rettigheter reservert.', da: 'Alle rettigheder forbeholdes.', de: 'Alle Rechte vorbehalten.' },
  
  // Cart
  'cart.title': { sv: 'Varukorg', en: 'Shopping Cart', no: 'Handlekurv', da: 'Indkøbskurv', de: 'Warenkorb' },
  'cart.empty': { sv: 'Din varukorg är tom', en: 'Your cart is empty', no: 'Handlekurven din er tom', da: 'Din indkøbskurv er tom', de: 'Ihr Warenkorb ist leer' },
  'cart.items': { sv: 'artiklar i varukorgen', en: 'items in your cart', no: 'varer i handlekurven', da: 'varer i kurven', de: 'Artikel im Warenkorb' },
  'cart.total': { sv: 'Totalt', en: 'Total', no: 'Totalt', da: 'Total', de: 'Gesamt' },
  'cart.checkout': { sv: 'Gå till kassan', en: 'Proceed to checkout', no: 'Gå til kassen', da: 'Gå til kassen', de: 'Zur Kasse' },
  'cart.creating': { sv: 'Skapar kassa...', en: 'Creating checkout...', no: 'Oppretter kasse...', da: 'Opretter kasse...', de: 'Kasse wird erstellt...' },
  'cart.added': { sv: 'Tillagd i varukorgen', en: 'Added to cart', no: 'Lagt i handlekurven', da: 'Tilføjet til kurven', de: 'Zum Warenkorb hinzugefügt' },
  
  // Product Detail
  'product.quantity': { sv: 'Antal', en: 'Quantity', no: 'Antall', da: 'Antal', de: 'Menge' },
  'product.outofstock': { sv: 'Slut i lager', en: 'Out of stock', no: 'Ikke på lager', da: 'Ikke på lager', de: 'Nicht auf Lager' },
  'product.back': { sv: 'Tillbaka', en: 'Back', no: 'Tilbake', da: 'Tilbage', de: 'Zurück' },
  'product.notfound': { sv: 'Produkten hittades inte', en: 'Product not found', no: 'Produktet ble ikke funnet', da: 'Produktet blev ikke fundet', de: 'Produkt nicht gefunden' },
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
    // Fallback to English (and then Swedish) if a specific language string is missing.
    return (
      translation[language] ??
      translation.en ??
      translation.sv ??
      key
    );
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
