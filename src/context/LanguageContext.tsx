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
  'nav.products': { sv: 'Produkter', en: 'Products', no: 'Produkter', da: 'Produkter', de: 'Produkte', fi: 'Tuotteet', nl: 'Producten', fr: 'Produits', es: 'Productos', pl: 'Produkty' },
  'nav.about': { sv: 'Om oss', en: 'About', no: 'Om oss', da: 'Om os', de: 'Über uns', fi: 'Tietoa meistä', nl: 'Over ons', fr: 'À propos', es: 'Sobre nosotros', pl: 'O nas' },
  'nav.contact': { sv: 'Kontakt', en: 'Contact', no: 'Kontakt', da: 'Kontakt', de: 'Kontakt', fi: 'Yhteystiedot', nl: 'Contact', fr: 'Contact', es: 'Contacto', pl: 'Kontakt' },
  
  // Hero
  'hero.badge': { sv: 'Grundat 2026', en: 'Founded 2026', no: 'Grunnlagt 2026', da: 'Grundlagt 2026', de: 'Gegründet 2026', fi: 'Perustettu 2026', nl: 'Opgericht 2026', fr: 'Fondé en 2026', es: 'Fundado en 2026', pl: 'Założony w 2026' },
  'hero.title': { sv: 'Giftfria Produkter som Faktiskt Fungerar', en: 'Toxin-Free Products That Actually Work', no: 'Giftfrie Produkter som Faktisk Fungerer', da: 'Giftfrie Produkter der Faktisk Virker', de: 'Schadstofffreie Produkte die Wirklich Funktionieren', fi: 'Myrkyttömät tuotteet jotka oikeasti toimivat', nl: 'Gifvrije producten die echt werken', fr: 'Des produits sans toxines qui fonctionnent vraiment', es: 'Productos sin toxinas que realmente funcionan', pl: 'Produkty bez toksyn, które naprawdę działają' },
  'hero.subtitle': { sv: 'Vi är inte det största företaget. Vi är det noggrannaste i vår research. Varje produkt vi säljer är noggrant utvald efter ingrediensanalys, internationella certifieringar och användarrecensioner.', en: "We're not the biggest company. We're the most thorough in our research. Every product we sell is carefully selected based on ingredient analysis, international certifications and user reviews.", no: 'Vi er ikke det største selskapet. Vi er de mest grundige i vår forskning.', da: 'Vi er ikke den største virksomhed. Vi er de mest grundige i vores forskning.', de: 'Wir sind nicht das größte Unternehmen. Wir sind die gründlichsten in unserer Forschung.', fi: 'Emme ole suurin yritys. Olemme perusteellisin tutkimuksessamme.', nl: 'Wij zijn niet het grootste bedrijf. Wij zijn de meest grondige in ons onderzoek.', fr: "Nous ne sommes pas la plus grande entreprise. Nous sommes les plus rigoureux dans notre recherche.", es: 'No somos la empresa más grande. Somos los más rigurosos en nuestra investigación.', pl: 'Nie jesteśmy największą firmą. Jesteśmy najbardziej dokładni w naszych badaniach.' },
  'hero.cta.primary': { sv: 'Shoppa giftfritt nu', en: 'Shop toxin-free now', no: 'Handle giftfritt nå', da: 'Shop giftfrit nu', de: 'Jetzt schadstofffrei kaufen', fi: 'Osta myrkyttömästi nyt', nl: 'Shop gifvrij nu', fr: 'Achetez sans toxines maintenant', es: 'Compra sin toxinas ahora', pl: 'Kupuj bez toksyn teraz' },
  'hero.cta.secondary': { sv: 'Läs mer om oss', en: 'Read more about us', no: 'Les mer om oss', da: 'Læs mere om os', de: 'Mehr über uns', fi: 'Lue lisää meistä', nl: 'Lees meer over ons', fr: 'En savoir plus sur nous', es: 'Lee más sobre nosotros', pl: 'Przeczytaj więcej o nas' },
  'hero.feature.delivery': { sv: 'Leverans i Europa', en: 'European delivery', no: 'Levering i Europa', da: 'Levering i Europa', de: 'Lieferung in Europa', fi: 'Toimitus Euroopassa', nl: 'Levering in Europa', fr: 'Livraison en Europe', es: 'Entrega en Europa', pl: 'Dostawa w Europie' },
  'hero.feature.transparent': { sv: 'Transparent business', en: 'Transparent business', no: 'Transparent business', da: 'Transparent business', de: 'Transparentes Geschäft', fi: 'Läpinäkyvä liiketoiminta', nl: 'Transparant bedrijf', fr: 'Entreprise transparente', es: 'Negocio transparente', pl: 'Przejrzysta firma' },
  'hero.feature.founded': { sv: 'Grundat 2026', en: 'Founded 2026', no: 'Grunnlagt 2026', da: 'Grundlagt 2026', de: 'Gegründet 2026', fi: 'Perustettu 2026', nl: 'Opgericht 2026', fr: 'Fondé en 2026', es: 'Fundado en 2026', pl: 'Założony w 2026' },
  'hero.scroll': { sv: 'Scrolla för produkter', en: 'Scroll for products', no: 'Scroll for produkter', da: 'Scroll for produkter', de: 'Scrollen für Produkte', fi: 'Vieritä tuotteita', nl: 'Scroll voor producten', fr: 'Défiler pour les produits', es: 'Desplázate para ver productos', pl: 'Przewiń po produkty' },

  // Navigation sub-menus
  'nav.whatsnew': { sv: 'Nytt hos oss', en: "What's New", no: 'Nytt hos oss', da: 'Nyt hos os', de: 'Neuheiten', fi: 'Uutta meillä', nl: 'Wat is er nieuw', fr: 'Quoi de neuf', es: 'Novedades', pl: 'Co nowego' },
  'nav.aboutus': { sv: 'Om oss', en: 'About us', no: 'Om oss', da: 'Om os', de: 'Über uns', fi: 'Tietoa meistä', nl: 'Over ons', fr: 'À propos', es: 'Sobre nosotros', pl: 'O nas' },
  'nav.donations': { sv: 'Donationer', en: 'Donations', no: 'Donasjoner', da: 'Donationer', de: 'Spenden', fi: 'Lahjoitukset', nl: 'Donaties', fr: 'Dons', es: 'Donaciones', pl: 'Darowizny' },
  'nav.contactus': { sv: 'Kontakta oss', en: 'Contact us', no: 'Kontakt oss', da: 'Kontakt os', de: 'Kontaktieren Sie uns', fi: 'Ota yhteyttä', nl: 'Neem contact op', fr: 'Contactez-nous', es: 'Contáctenos', pl: 'Skontaktuj się' },
  'nav.partnership': { sv: 'Samarbete', en: 'Partnership', no: 'Samarbeid', da: 'Samarbejde', de: 'Partnerschaft', fi: 'Kumppanuus', nl: 'Partnerschap', fr: 'Partenariat', es: 'Asociación', pl: 'Partnerstwo' },
  'nav.business': { sv: 'Handla som företag', en: 'Business', no: 'Handle som bedrift', da: 'Bestil som virksomhed', de: 'Geschäftskunden', fi: 'Yritysostot', nl: 'Zakelijk bestellen', fr: 'Commande professionnelle', es: 'Compra empresarial', pl: 'Zakupy firmowe' },
  'nav.suggestproduct': { sv: 'Önska produkt', en: 'Suggest product', no: 'Ønsk produkt', da: 'Ønsk produkt', de: 'Produkt vorschlagen', fi: 'Ehdota tuotetta', nl: 'Product voorstellen', fr: 'Suggérer un produit', es: 'Sugerir producto', pl: 'Zaproponuj produkt' },
  'nav.categories': { sv: 'Kategorier', en: 'Categories', no: 'Kategorier', da: 'Kategorier', de: 'Kategorien', fi: 'Kategoriat', nl: 'Categorieën', fr: 'Catégories', es: 'Categorías', pl: 'Kategorie' },
  'nav.myaccount': { sv: 'Mitt konto', en: 'My Account', no: 'Min konto', da: 'Min konto', de: 'Mein Konto', fi: 'Oma tili', nl: 'Mijn account', fr: 'Mon compte', es: 'Mi cuenta', pl: 'Moje konto' },
  'nav.signout': { sv: 'Logga ut', en: 'Sign out', no: 'Logg ut', da: 'Log ud', de: 'Abmelden', fi: 'Kirjaudu ulos', nl: 'Uitloggen', fr: 'Se déconnecter', es: 'Cerrar sesión', pl: 'Wyloguj się' },
  'nav.signin': { sv: 'Logga in / Skapa konto', en: 'Sign in / Create account', no: 'Logg inn / Opprett konto', da: 'Log ind / Opret konto', de: 'Anmelden / Konto erstellen', fi: 'Kirjaudu / Luo tili', nl: 'Inloggen / Account aanmaken', fr: 'Connexion / Créer un compte', es: 'Iniciar sesión / Crear cuenta', pl: 'Zaloguj / Utwórz konto' },
  'nav.trackorder': { sv: 'Spåra order', en: 'Track Order', no: 'Spor ordre', da: 'Spor ordre', de: 'Bestellung verfolgen', fi: 'Seuraa tilausta', nl: 'Bestelling volgen', fr: 'Suivre commande', es: 'Rastrear pedido', pl: 'Śledź zamówienie' },

  // Products
  'products.title': { sv: 'Våra Produkter', en: 'Our Products', no: 'Våre Produkter', da: 'Vores Produkter', de: 'Unsere Produkte', fi: 'Tuotteemme', nl: 'Onze producten', fr: 'Nos produits', es: 'Nuestros productos', pl: 'Nasze produkty' },
  'products.addtocart': { sv: 'Lägg i varukorg', en: 'Add to cart', no: 'Legg i handlekurv', da: 'Læg i kurv', de: 'In den Warenkorb', fi: 'Lisää koriin', nl: 'In winkelwagen', fr: 'Ajouter au panier', es: 'Agregar al carrito', pl: 'Dodaj do koszyka' },
  'products.viewdetails': { sv: 'Visa detaljer', en: 'View details', no: 'Se detaljer', da: 'Se detaljer', de: 'Details anzeigen', fi: 'Näytä tiedot', nl: 'Bekijk details', fr: 'Voir les détails', es: 'Ver detalles', pl: 'Zobacz szczegóły' },
  'products.noproducts': { sv: 'Inga produkter hittades', en: 'No products found', no: 'Ingen produkter funnet', da: 'Ingen produkter fundet', de: 'Keine Produkte gefunden', fi: 'Tuotteita ei löytynyt', nl: 'Geen producten gevonden', fr: 'Aucun produit trouvé', es: 'No se encontraron productos', pl: 'Nie znaleziono produktów' },
  'products.loading': { sv: 'Laddar produkter...', en: 'Loading products...', no: 'Laster produkter...', da: 'Indlæser produkter...', de: 'Produkte werden geladen...', fi: 'Ladataan tuotteita...', nl: 'Producten laden...', fr: 'Chargement des produits...', es: 'Cargando productos...', pl: 'Ładowanie produktów...' },
  'products.error': { sv: 'Kunde inte ladda produkter', en: 'Failed to load products', no: 'Kunne ikke laste produkter', da: 'Kunne ikke indlæse produkter', de: 'Produkte konnten nicht geladen werden', fi: 'Tuotteiden lataus epäonnistui', nl: 'Producten laden mislukt', fr: 'Échec du chargement des produits', es: 'No se pudieron cargar los productos', pl: 'Nie udało się załadować produktów' },
  
  // About
  'about.title': { sv: 'Varför välja', en: 'Why choose', no: 'Hvorfor velge', da: 'Hvorfor vælge', de: 'Warum wählen', fi: 'Miksi valita', nl: 'Waarom kiezen', fr: 'Pourquoi choisir', es: 'Por qué elegir', pl: 'Dlaczego wybrać' },
  'about.description1': { sv: 'Vi tror på att leva rent - både för din kropp och för planeten.', en: 'We believe in living clean - both for your body and for the planet.', no: 'Vi tror på å leve rent - både for kroppen din og for planeten.', da: 'Vi tror på at leve rent - både for din krop og for planeten.', de: 'Wir glauben an ein sauberes Leben - sowohl für Ihren Körper als auch für den Planeten.', fi: 'Uskomme puhtaaseen elämään – sekä kehollesi että planeetalle.', nl: 'Wij geloven in schoon leven - voor je lichaam en de planeet.', fr: 'Nous croyons en un mode de vie sain - pour votre corps et la planète.', es: 'Creemos en vivir limpio - tanto para tu cuerpo como para el planeta.', pl: 'Wierzymy w czyste życie – dla twojego ciała i planety.' },
  'about.description2': { sv: 'Från naturliga kroppsvårdsprodukter till hållbar teknik och giftfria kläder.', en: 'From natural body care to sustainable tech and toxin-free clothing.', no: 'Fra naturlige kroppsprodukter til bærekraftig teknologi og giftfrie klær.', da: 'Fra naturlige kropspleje til bæredygtig teknologi og giftfrit tøj.', de: 'Von natürlicher Körperpflege bis zu nachhaltiger Technologie.', fi: 'Luonnonmukaisesta kehonhoidosta kestävään teknologiaan ja myrkyttömiin vaatteisiin.', nl: 'Van natuurlijke lichaamsverzorging tot duurzame technologie en gifvrije kleding.', fr: 'Des soins naturels aux vêtements sans toxines et à la tech durable.', es: 'Desde cuidado natural hasta ropa sin toxinas y tecnología sostenible.', pl: 'Od naturalnej pielęgnacji ciała po zrównoważoną technologię i odzież bez toksyn.' },
  'about.stat.customers': { sv: 'Nöjda kunder', en: 'Happy customers', no: 'Fornøyde kunder', da: 'Tilfredse kunder', de: 'Zufriedene Kunden', fi: 'Tyytyväiset asiakkaat', nl: 'Tevreden klanten', fr: 'Clients satisfaits', es: 'Clientes satisfechos', pl: 'Zadowoleni klienci' },
  'about.stat.natural': { sv: 'Naturligt', en: 'Natural', no: 'Naturlig', da: 'Naturligt', de: 'Natürlich', fi: 'Luonnollinen', nl: 'Natuurlijk', fr: 'Naturel', es: 'Natural', pl: 'Naturalny' },
  'about.stat.toxinfree': { sv: 'Alla produkter', en: 'All products', no: 'Alle produkter', da: 'Alle produkter', de: 'Alle Produkte', fi: 'Kaikki tuotteet', nl: 'Alle producten', fr: 'Tous les produits', es: 'Todos los productos', pl: 'Wszystkie produkty' },
  'about.stat.service': { sv: 'Personlig service', en: 'Personal service', no: 'Personlig service', da: 'Personlig service', de: 'Persönlicher Service', fi: 'Henkilökohtainen palvelu', nl: 'Persoonlijke service', fr: 'Service personnalisé', es: 'Servicio personal', pl: 'Osobista obsługa' },
  'about.visual.title': { sv: 'Naturligt & Hållbart', en: 'Natural & Sustainable', no: 'Naturlig & Bærekraftig', da: 'Naturligt & Bæredygtigt', de: 'Natürlich & Nachhaltig', fi: 'Luonnollinen & Kestävä', nl: 'Natuurlijk & Duurzaam', fr: 'Naturel & Durable', es: 'Natural & Sostenible', pl: 'Naturalny & Zrównoważony' },
  'about.visual.description': { sv: 'Alla våra produkter är noggrant utvalda för att vara giftfria och miljövänliga', en: 'All our products are carefully selected to be toxin-free and eco-friendly', no: 'Alle våre produkter er nøye utvalgt for å være giftfrie og miljøvennlige', da: 'Alle vores produkter er omhyggeligt udvalgt for at være giftfrie og miljøvenlige', de: 'Alle unsere Produkte sind sorgfältig ausgewählt, um schadstofffrei und umweltfreundlich zu sein', fi: 'Kaikki tuotteemme on huolellisesti valittu olemaan myrkyttömiä ja ympäristöystävällisiä', nl: 'Al onze producten zijn zorgvuldig geselecteerd om gifvrij en milieuvriendelijk te zijn', fr: 'Tous nos produits sont soigneusement sélectionnés pour être sans toxines et écologiques', es: 'Todos nuestros productos son cuidadosamente seleccionados para ser sin toxinas y ecológicos', pl: 'Wszystkie nasze produkty są starannie dobrane, aby być wolne od toksyn i przyjazne środowisku' },
  
  // Footer
  'footer.description': { sv: 'Din destination för giftfria produkter och hållbar teknik.', en: 'Your destination for toxin-free products and sustainable tech.', no: 'Din destinasjon for giftfrie produkter og bærekraftig teknologi.', da: 'Din destination for giftfrie produkter og bæredygtig teknologi.', de: 'Ihr Ziel für schadstofffreie Produkte und nachhaltige Technologie.', fi: 'Kohteesi myrkyttömille tuotteille ja kestävälle teknologialle.', nl: 'Uw bestemming voor gifvrije producten en duurzame technologie.', fr: 'Votre destination pour les produits sans toxines et la tech durable.', es: 'Tu destino para productos sin toxinas y tecnología sostenible.', pl: 'Twoje miejsce na produkty bez toksyn i zrównoważoną technologię.' },
  'footer.quicklinks': { sv: 'Snabblänkar', en: 'Quick Links', no: 'Hurtiglenker', da: 'Hurtige links', de: 'Schnelllinks', fi: 'Pikalinkit', nl: 'Snelle links', fr: 'Liens rapides', es: 'Enlaces rápidos', pl: 'Szybkie linki' },
  'footer.customerservice': { sv: 'Kundtjänst', en: 'Customer Service', no: 'Kundeservice', da: 'Kundeservice', de: 'Kundenservice', fi: 'Asiakaspalvelu', nl: 'Klantenservice', fr: 'Service client', es: 'Servicio al cliente', pl: 'Obsługa klienta' },
  'footer.shippinginfo': { sv: 'Fraktinformation', en: 'Shipping Info', no: 'Fraktinformasjon', da: 'Fragtinformation', de: 'Versandinfo', fi: 'Toimitusohjeet', nl: 'Verzendinfo', fr: 'Infos livraison', es: 'Info de envío', pl: 'Informacje o wysyłce' },
  'footer.returns': { sv: 'Byten & Returer', en: 'Returns & Exchanges', no: 'Bytte & Retur', da: 'Bytte & Retur', de: 'Umtausch & Rückgabe', fi: 'Palautukset & vaihdot', nl: 'Retourneren & Ruilen', fr: 'Retours & Échanges', es: 'Devoluciones y cambios', pl: 'Zwroty i wymiana' },
  'footer.faq': { sv: 'Vanliga frågor', en: 'FAQ', no: 'Vanlige spørsmål', da: 'Ofte stillede spørgsmål', de: 'Häufige Fragen', fi: 'Usein kysytyt kysymykset', nl: 'Veelgestelde vragen', fr: 'FAQ', es: 'Preguntas frecuentes', pl: 'Często zadawane pytania' },
  'footer.contact': { sv: 'Kontakt', en: 'Contact', no: 'Kontakt', da: 'Kontakt', de: 'Kontakt', fi: 'Yhteystiedot', nl: 'Contact', fr: 'Contact', es: 'Contacto', pl: 'Kontakt' },
  'footer.rights': { sv: 'Alla rättigheter förbehållna.', en: 'All rights reserved.', no: 'Alle rettigheter reservert.', da: 'Alle rettigheder forbeholdes.', de: 'Alle Rechte vorbehalten.', fi: 'Kaikki oikeudet pidätetään.', nl: 'Alle rechten voorbehouden.', fr: 'Tous droits réservés.', es: 'Todos los derechos reservados.', pl: 'Wszelkie prawa zastrzeżone.' },
  
  // Cart
  'cart.title': { sv: 'Varukorg', en: 'Shopping Cart', no: 'Handlekurv', da: 'Indkøbskurv', de: 'Warenkorb', fi: 'Ostoskori', nl: 'Winkelwagen', fr: 'Panier', es: 'Carrito', pl: 'Koszyk' },
  'cart.empty': { sv: 'Din varukorg är tom', en: 'Your cart is empty', no: 'Handlekurven din er tom', da: 'Din indkøbskurv er tom', de: 'Ihr Warenkorb ist leer', fi: 'Ostoskorisi on tyhjä', nl: 'Uw winkelwagen is leeg', fr: 'Votre panier est vide', es: 'Tu carrito está vacío', pl: 'Twój koszyk jest pusty' },
  'cart.items': { sv: 'artiklar i varukorgen', en: 'items in your cart', no: 'varer i handlekurven', da: 'varer i kurven', de: 'Artikel im Warenkorb', fi: 'tuotetta ostoskorissa', nl: 'artikelen in winkelwagen', fr: 'articles dans votre panier', es: 'artículos en el carrito', pl: 'produktów w koszyku' },
  'cart.total': { sv: 'Totalt', en: 'Total', no: 'Totalt', da: 'Total', de: 'Gesamt', fi: 'Yhteensä', nl: 'Totaal', fr: 'Total', es: 'Total', pl: 'Łącznie' },
  'cart.checkout': { sv: 'Gå till kassan', en: 'Proceed to checkout', no: 'Gå til kassen', da: 'Gå til kassen', de: 'Zur Kasse', fi: 'Siirry kassalle', nl: 'Naar kassa', fr: 'Passer à la caisse', es: 'Ir a la caja', pl: 'Przejdź do kasy' },
  'cart.creating': { sv: 'Skapar kassa...', en: 'Creating checkout...', no: 'Oppretter kasse...', da: 'Opretter kasse...', de: 'Kasse wird erstellt...', fi: 'Luodaan kassaa...', nl: 'Kassa aanmaken...', fr: 'Création du paiement...', es: 'Creando pago...', pl: 'Tworzenie kasy...' },
  'cart.added': { sv: 'Tillagd i varukorgen', en: 'Added to cart', no: 'Lagt i handlekurven', da: 'Tilføjet til kurven', de: 'Zum Warenkorb hinzugefügt', fi: 'Lisätty koriin', nl: 'Toegevoegd aan winkelwagen', fr: 'Ajouté au panier', es: 'Añadido al carrito', pl: 'Dodano do koszyka' },
  
  // Product Detail
  'product.quantity': { sv: 'Antal', en: 'Quantity', no: 'Antall', da: 'Antal', de: 'Menge', fi: 'Määrä', nl: 'Aantal', fr: 'Quantité', es: 'Cantidad', pl: 'Ilość' },
  'product.outofstock': { sv: 'Slut i lager', en: 'Out of stock', no: 'Ikke på lager', da: 'Ikke på lager', de: 'Nicht auf Lager', fi: 'Loppuunmyyty', nl: 'Uitverkocht', fr: 'Rupture de stock', es: 'Agotado', pl: 'Wyprzedane' },
  'product.back': { sv: 'Tillbaka', en: 'Back', no: 'Tilbake', da: 'Tilbage', de: 'Zurück', fi: 'Takaisin', nl: 'Terug', fr: 'Retour', es: 'Volver', pl: 'Wróć' },
  'product.notfound': { sv: 'Produkten hittades inte', en: 'Product not found', no: 'Produktet ble ikke funnet', da: 'Produktet blev ikke fundet', de: 'Produkt nicht gefunden', fi: 'Tuotetta ei löydy', nl: 'Product niet gevonden', fr: 'Produit introuvable', es: 'Producto no encontrado', pl: 'Produkt nie znaleziony' },
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
  const [language, setLanguage] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('preferred-language') as Language | null;
      const valid: Language[] = ['sv', 'en', 'no', 'da', 'de', 'fi', 'nl', 'fr', 'es', 'pl'];
      return saved && valid.includes(saved) ? saved : 'sv';
    } catch {
      return 'sv';
    }
  });
  const contentLang = getContentLang(language);

  const handleSetLanguage = (lang: Language) => {
    try {
      localStorage.setItem('preferred-language', lang);
    } catch {}
    setLanguage(lang);
  };

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
    <LanguageContext.Provider value={{ language, contentLang, setLanguage: handleSetLanguage, t }}>
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
