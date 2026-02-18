import React, { createContext, useContext, useState, ReactNode } from 'react';

export type Language = 'sv' | 'en' | 'no' | 'da' | 'de' | 'fi' | 'nl' | 'fr' | 'es' | 'pl';

/**
 * Maps any Language to 'sv' or 'en' for components that only have those two content sets.
 * Scandinavian languages (no, da) map to Swedish since they're mutually intelligible.
 */
export function getContentLang(language: Language): 'sv' | 'en' {
  if (language === 'sv' || language === 'no' || language === 'da') return 'sv';
  return 'en';
}

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
  'hero.badge': { sv: 'Grundat 2026', en: 'Founded 2026', no: 'Grunnlagt 2026', da: 'Grundlagt 2026', de: 'Gegründet 2026' },
  'hero.title': { sv: 'Giftfria Produkter som Faktiskt Fungerar', en: 'Toxin-Free Products That Actually Work', no: 'Giftfrie Produkter som Faktisk Fungerer', da: 'Giftfrie Produkter der Faktisk Virker', de: 'Schadstofffreie Produkte die Wirklich Funktionieren' },
  'hero.subtitle': { sv: 'Vi är inte det största företaget. Vi är det noggrannaste i vår research. Varje produkt vi säljer är noggrant utvald efter ingrediensanalys, internationella certifieringar och användarrecensioner.', en: "We're not the biggest company. We're the most thorough in our research. Every product we sell is carefully selected based on ingredient analysis, international certifications and user reviews.", no: 'Vi er ikke det største selskapet. Vi er de mest grundige i vår forskning. Hvert produkt vi selger er nøye utvalgt basert på ingrediensanalyse, internasjonale sertifiseringer og brukeranmeldelser.', da: 'Vi er ikke den største virksomhed. Vi er de mest grundige i vores forskning. Hvert produkt vi sælger er omhyggeligt udvalgt baseret på ingrediensanalyse, internationale certificeringer og brugeranmeldelser.', de: 'Wir sind nicht das größte Unternehmen. Wir sind die gründlichsten in unserer Forschung. Jedes Produkt, das wir verkaufen, wird sorgfältig anhand von Inhaltsstoffanalysen, internationalen Zertifizierungen und Nutzerbewertungen ausgewählt.' },
  'hero.cta.primary': { sv: 'Shoppa giftfritt nu', en: 'Shop toxin-free now', no: 'Handle giftfritt nå', da: 'Shop giftfrit nu', de: 'Jetzt schadstofffrei kaufen' },
  'hero.cta.secondary': { sv: 'Läs mer om oss', en: 'Read more about us', no: 'Les mer om oss', da: 'Læs mere om os', de: 'Mehr über uns' },
  'hero.feature.delivery': { sv: 'Leverans i Europa', en: 'European delivery', no: 'Levering i Europa', da: 'Levering i Europa', de: 'Lieferung in Europa' },
  'hero.feature.transparent': { sv: 'Transparent business', en: 'Transparent business', no: 'Transparent business', da: 'Transparent business', de: 'Transparentes Geschäft' },
  'hero.feature.founded': { sv: 'Grundat 2026', en: 'Founded 2026', no: 'Grunnlagt 2026', da: 'Grundlagt 2026', de: 'Gegründet 2026' },
  'hero.scroll': { sv: 'Scrolla för produkter', en: 'Scroll for products', no: 'Scroll for produkter', da: 'Scroll for produkter', de: 'Scrollen für Produkte' },

  // Navigation sub-menus
  'nav.whatsnew': { sv: 'Nytt hos oss', en: "What's New", no: 'Nytt hos oss', da: 'Nyt hos os', de: 'Neuheiten' },
  'nav.aboutus': { sv: 'Om oss', en: 'About us', no: 'Om oss', da: 'Om os', de: 'Über uns' },
  'nav.donations': { sv: 'Donationer', en: 'Donations', no: 'Donasjoner', da: 'Donationer', de: 'Spenden' },
  'nav.contactus': { sv: 'Kontakta oss', en: 'Contact us', no: 'Kontakt oss', da: 'Kontakt os', de: 'Kontaktieren Sie uns' },
  'nav.partnership': { sv: 'Samarbete', en: 'Partnership', no: 'Samarbeid', da: 'Samarbejde', de: 'Partnerschaft' },
  'nav.business': { sv: 'Handla som företag', en: 'Business', no: 'Handle som bedrift', da: 'Bestil som virksomhed', de: 'Geschäftskunden' },
  'nav.suggestproduct': { sv: 'Önska produkt', en: 'Suggest product', no: 'Ønsk produkt', da: 'Ønsk produkt', de: 'Produkt vorschlagen' },

  'nav.categories': { sv: 'Kategorier', en: 'Categories', no: 'Kategorier', da: 'Kategorier', de: 'Kategorien' },
  'nav.myaccount': { sv: 'Mitt konto', en: 'My Account', no: 'Min konto', da: 'Min konto', de: 'Mein Konto' },
  'nav.signout': { sv: 'Logga ut', en: 'Sign out', no: 'Logg ut', da: 'Log ud', de: 'Abmelden' },
  'nav.signin': { sv: 'Logga in / Skapa konto', en: 'Sign in / Create account', no: 'Logg inn / Opprett konto', da: 'Log ind / Opret konto', de: 'Anmelden / Konto erstellen' },
  'nav.trackorder': { sv: 'Spåra order', en: 'Track Order', no: 'Spor ordre', da: 'Spor ordre', de: 'Bestellung verfolgen' },

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
  /** 'sv' for Scandinavian languages, 'en' for everything else */
  contentLang: 'sv' | 'en';
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguage] = useState<Language>('sv');
  const contentLang = getContentLang(language);

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
    <LanguageContext.Provider value={{ language, contentLang, setLanguage, t }}>
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
