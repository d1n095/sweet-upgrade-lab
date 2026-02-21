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
  'product.back': { sv: 'Tillbaka till butiken', en: 'Back to shop', no: 'Tilbake til butikken', da: 'Tilbage til butikken', de: 'Zurück zum Shop', fi: 'Takaisin kauppaan', nl: 'Terug naar winkel', fr: 'Retour à la boutique', es: 'Volver a la tienda', pl: 'Wróć do sklepu' },
  'product.notfound': { sv: 'Produkten hittades inte', en: 'Product not found', no: 'Produktet ble ikke funnet', da: 'Produktet blev ikke fundet', de: 'Produkt nicht gefunden', fi: 'Tuotetta ei löydy', nl: 'Product niet gevonden', fr: 'Produit introuvable', es: 'Producto no encontrado', pl: 'Produkt nie znaleziony' },
  'product.addtocart': { sv: 'Lägg i kundvagn', en: 'Add to cart', no: 'Legg i handlekurv', da: 'Læg i kurv', de: 'In den Warenkorb', fi: 'Lisää koriin', nl: 'In winkelwagen', fr: 'Ajouter au panier', es: 'Agregar al carrito', pl: 'Dodaj do koszyka' },
  'product.added': { sv: 'Tillagd i kundvagnen', en: 'Added to cart', no: 'Lagt i handlekurven', da: 'Tilføjet til kurven', de: 'Zum Warenkorb hinzugefügt', fi: 'Lisätty koriin', nl: 'Toegevoegd aan winkelwagen', fr: 'Ajouté au panier', es: 'Añadido al carrito', pl: 'Dodano do koszyka' },
  'product.noimage': { sv: 'Ingen bild', en: 'No image', no: 'Ingen bilde', da: 'Intet billede', de: 'Kein Bild', fi: 'Ei kuvaa', nl: 'Geen afbeelding', fr: 'Pas d\'image', es: 'Sin imagen', pl: 'Brak zdjęcia' },
  'product.instock': { sv: '✓ I lager', en: '✓ In stock', no: '✓ På lager', da: '✓ På lager', de: '✓ Auf Lager', fi: '✓ Varastossa', nl: '✓ Op voorraad', fr: '✓ En stock', es: '✓ En stock', pl: '✓ W magazynie' },
  'product.lowstock': { sv: '🔥 Bara {count} kvar!', en: '🔥 Only {count} left!', no: '🔥 Bare {count} igjen!', da: '🔥 Kun {count} tilbage!', de: '🔥 Nur noch {count}!', fi: '🔥 Vain {count} jäljellä!', nl: '🔥 Nog maar {count}!', fr: '🔥 Plus que {count}!', es: '🔥 ¡Solo quedan {count}!', pl: '🔥 Tylko {count} zostało!' },
  'product.outofstockwarning': { sv: '⚠️ Slut i lager', en: '⚠️ Out of stock', no: '⚠️ Ikke på lager', da: '⚠️ Ikke på lager', de: '⚠️ Nicht auf Lager', fi: '⚠️ Loppuunmyyty', nl: '⚠️ Uitverkocht', fr: '⚠️ Rupture de stock', es: '⚠️ Agotado', pl: '⚠️ Wyprzedane' },
  'product.securepayment': { sv: 'Säker betalning', en: 'Secure payment', no: 'Sikker betaling', da: 'Sikker betaling', de: 'Sichere Zahlung', fi: 'Turvallinen maksu', nl: 'Veilig betalen', fr: 'Paiement sécurisé', es: 'Pago seguro', pl: 'Bezpieczna płatność' },
  'product.returns': { sv: '30 dagars öppet köp', en: '30-day returns', no: '30 dagers returrett', da: '30 dages returret', de: '30 Tage Rückgabe', fi: '30 päivän palautusoikeus', nl: '30 dagen retour', fr: 'Retour sous 30 jours', es: 'Devolución 30 días', pl: '30 dni na zwrot' },
  'product.fastdelivery': { sv: 'Snabb leverans', en: 'Fast delivery', no: 'Rask levering', da: 'Hurtig levering', de: 'Schnelle Lieferung', fi: 'Nopea toimitus', nl: 'Snelle levering', fr: 'Livraison rapide', es: 'Entrega rápida', pl: 'Szybka dostawa' },
  'product.reviews': { sv: 'Kundrecensioner', en: 'Customer Reviews', no: 'Kundeanmeldelser', da: 'Kundeanmeldelser', de: 'Kundenbewertungen', fi: 'Asiakasarvostelut', nl: 'Klantbeoordelingen', fr: 'Avis clients', es: 'Reseñas de clientes', pl: 'Opinie klientów' },

  // Shop page
  'shop.title': { sv: 'Alla Produkter', en: 'All Products', no: 'Alle Produkter', da: 'Alle Produkter', de: 'Alle Produkte', fi: 'Kaikki Tuotteet', nl: 'Alle Producten', fr: 'Tous les Produits', es: 'Todos los Productos', pl: 'Wszystkie Produkty' },
  'shop.subtitle': { sv: 'Upptäck vårt sortiment av hållbara och naturliga produkter', en: 'Discover our range of sustainable and natural products', no: 'Oppdag vårt utvalg av bærekraftige og naturlige produkter', da: 'Opdag vores udvalg af bæredygtige og naturlige produkter', de: 'Entdecken Sie unser Sortiment nachhaltiger und natürlicher Produkte', fi: 'Tutustu valikoimaamme kestäviä ja luonnollisia tuotteita', nl: 'Ontdek ons assortiment duurzame en natuurlijke producten', fr: 'Découvrez notre gamme de produits durables et naturels', es: 'Descubre nuestra gama de productos sostenibles y naturales', pl: 'Odkryj nasz asortyment zrównoważonych i naturalnych produktów' },
  'shop.freeshipping': { sv: 'Fri frakt över {threshold} kr', en: 'Free shipping over {threshold} kr', no: 'Fri frakt over {threshold} kr', da: 'Gratis fragt over {threshold} kr', de: 'Kostenloser Versand ab {threshold} SEK', fi: 'Ilmainen toimitus yli {threshold} kr', nl: 'Gratis verzending boven {threshold} SEK', fr: 'Livraison gratuite dès {threshold} SEK', es: 'Envío gratis a partir de {threshold} SEK', pl: 'Darmowa dostawa od {threshold} SEK' },

  // About page
  'about.page.ourstory': { sv: 'Vår Historia', en: 'Our Story', no: 'Vår Historie', da: 'Vores Historie', de: 'Unsere Geschichte', fi: 'Meidän Tarina', nl: 'Ons Verhaal', fr: 'Notre Histoire', es: 'Nuestra Historia', pl: 'Nasza Historia' },
  'about.page.about': { sv: 'Om', en: 'About', no: 'Om', da: 'Om', de: 'Über', fi: 'Tietoa', nl: 'Over', fr: 'À propos de', es: 'Sobre', pl: 'O' },
  'about.page.intro': { sv: 'Vi är ett europeiskt företag med en passion för hållbara och naturliga produkter. Vår vision är att göra det enkelt för alla att leva ett renare liv – utan att kompromissa med kvalitet eller stil.', en: 'We are a European company with a passion for sustainable and natural products. Our vision is to make it easy for everyone to live a cleaner life – without compromising on quality or style.', no: 'Vi er et europeisk selskap med en lidenskap for bærekraftige og naturlige produkter.', da: 'Vi er en europæisk virksomhed med passion for bæredygtige og naturlige produkter.', de: 'Wir sind ein europäisches Unternehmen mit Leidenschaft für nachhaltige und natürliche Produkte.', fi: 'Olemme eurooppalainen yritys, jolla on intohimo kestäviin ja luonnollisiin tuotteisiin.', nl: 'Wij zijn een Europees bedrijf met passie voor duurzame en natuurlijke producten.', fr: 'Nous sommes une entreprise européenne passionnée par les produits durables et naturels.', es: 'Somos una empresa europea con pasión por los productos sostenibles y naturales.', pl: 'Jesteśmy europejską firmą z pasją do zrównoważonych i naturalnych produktów.' },
  'about.page.values': { sv: 'Våra Värderingar', en: 'Our Values', no: 'Våre Verdier', da: 'Vores Værdier', de: 'Unsere Werte', fi: 'Arvomme', nl: 'Onze Waarden', fr: 'Nos Valeurs', es: 'Nuestros Valores', pl: 'Nasze Wartości' },
  'about.page.journey': { sv: 'Vår Resa', en: 'Our Journey', no: 'Vår Reise', da: 'Vores Rejse', de: 'Unsere Reise', fi: 'Matkamme', nl: 'Onze Reis', fr: 'Notre Parcours', es: 'Nuestro Camino', pl: 'Nasza Podróż' },
  'about.page.promise': { sv: 'Vårt Löfte', en: 'Our Promise', no: 'Vårt Løfte', da: 'Vores Løfte', de: 'Unser Versprechen', fi: 'Lupauksemme', nl: 'Onze Belofte', fr: 'Notre Promesse', es: 'Nuestra Promesa', pl: 'Nasza Obietnica' },
  'about.page.promisetext': { sv: 'Vi lovar att alltid prioritera kvalitet, hållbarhet och din hälsa. Varje produkt i vårt sortiment har valts med omsorg.', en: 'We promise to always prioritize quality, sustainability and your health. Every product in our range has been chosen with care.', no: 'Vi lover å alltid prioritere kvalitet, bærekraft og din helse.', da: 'Vi lover altid at prioritere kvalitet, bæredygtighed og din sundhed.', de: 'Wir versprechen, Qualität, Nachhaltigkeit und Ihre Gesundheit stets zu priorisieren.', fi: 'Lupaamme aina asettaa laadun, kestävyyden ja terveytesi etusijalle.', nl: 'Wij beloven kwaliteit, duurzaamheid en uw gezondheid altijd voorop te stellen.', fr: 'Nous promettons de toujours privilégier la qualité, la durabilité et votre santé.', es: 'Prometemos siempre priorizar la calidad, la sostenibilidad y tu salud.', pl: 'Obiecujemy zawsze stawiać na jakość, zrównoważony rozwój i Twoje zdrowie.' },

  // Contact page
  'contact.title': { sv: 'Kontakta Oss', en: 'Contact Us', no: 'Kontakt Oss', da: 'Kontakt Os', de: 'Kontaktieren Sie Uns', fi: 'Ota Yhteyttä', nl: 'Neem Contact Op', fr: 'Contactez-Nous', es: 'Contáctenos', pl: 'Skontaktuj się' },
  'contact.heading': { sv: 'Hur kan vi hjälpa dig?', en: 'How can we help you?', no: 'Hvordan kan vi hjelpe deg?', da: 'Hvordan kan vi hjælpe dig?', de: 'Wie können wir Ihnen helfen?', fi: 'Miten voimme auttaa?', nl: 'Hoe kunnen wij u helpen?', fr: 'Comment pouvons-nous vous aider?', es: '¿Cómo podemos ayudarte?', pl: 'Jak możemy Ci pomóc?' },
  'contact.subtitle': { sv: 'Vi finns här för att svara på dina frågor. Hör av dig så återkommer vi så snart som möjligt.', en: 'We\'re here to answer your questions. Get in touch and we\'ll get back to you as soon as possible.', no: 'Vi er her for å svare på spørsmålene dine.', da: 'Vi er her for at besvare dine spørgsmål.', de: 'Wir sind hier, um Ihre Fragen zu beantworten.', fi: 'Olemme täällä vastaamassa kysymyksiisi.', nl: 'Wij zijn er om uw vragen te beantwoorden.', fr: 'Nous sommes là pour répondre à vos questions.', es: 'Estamos aquí para responder sus preguntas.', pl: 'Jesteśmy tutaj, aby odpowiedzieć na Twoje pytania.' },
  'contact.sendmessage': { sv: 'Skicka meddelande', en: 'Send a message', no: 'Send melding', da: 'Send besked', de: 'Nachricht senden', fi: 'Lähetä viesti', nl: 'Stuur bericht', fr: 'Envoyer un message', es: 'Enviar mensaje', pl: 'Wyślij wiadomość' },
  'contact.name': { sv: 'Namn', en: 'Name', no: 'Navn', da: 'Navn', de: 'Name', fi: 'Nimi', nl: 'Naam', fr: 'Nom', es: 'Nombre', pl: 'Imię' },
  'contact.email': { sv: 'E-post', en: 'Email', no: 'E-post', da: 'E-mail', de: 'E-Mail', fi: 'Sähköposti', nl: 'E-mail', fr: 'E-mail', es: 'Correo electrónico', pl: 'E-mail' },
  'contact.subject': { sv: 'Ämne', en: 'Subject', no: 'Emne', da: 'Emne', de: 'Betreff', fi: 'Aihe', nl: 'Onderwerp', fr: 'Objet', es: 'Asunto', pl: 'Temat' },
  'contact.message': { sv: 'Meddelande', en: 'Message', no: 'Melding', da: 'Besked', de: 'Nachricht', fi: 'Viesti', nl: 'Bericht', fr: 'Message', es: 'Mensaje', pl: 'Wiadomość' },
  'contact.sending': { sv: 'Skickar...', en: 'Sending...', no: 'Sender...', da: 'Sender...', de: 'Senden...', fi: 'Lähetetään...', nl: 'Verzenden...', fr: 'Envoi...', es: 'Enviando...', pl: 'Wysyłanie...' },
  'contact.info': { sv: 'Kontaktinformation', en: 'Contact Information', no: 'Kontaktinformasjon', da: 'Kontaktinformation', de: 'Kontaktinformationen', fi: 'Yhteystiedot', nl: 'Contactgegevens', fr: 'Coordonnées', es: 'Información de contacto', pl: 'Dane kontaktowe' },
  'contact.responsetime': { sv: 'Svarstid', en: 'Response time', no: 'Svartid', da: 'Svartid', de: 'Antwortzeit', fi: 'Vastausaika', nl: 'Reactietijd', fr: 'Temps de réponse', es: 'Tiempo de respuesta', pl: 'Czas odpowiedzi' },
  'contact.within24h': { sv: 'Inom 24 timmar', en: 'Within 24 hours', no: 'Innen 24 timer', da: 'Inden for 24 timer', de: 'Innerhalb von 24 Stunden', fi: '24 tunnin sisällä', nl: 'Binnen 24 uur', fr: 'Sous 24 heures', es: 'Dentro de 24 horas', pl: 'W ciągu 24 godzin' },
  'contact.thankyou': { sv: 'Tack för ditt meddelande! Vi återkommer inom 24 timmar.', en: 'Thank you for your message! We\'ll get back to you within 24 hours.', no: 'Takk for meldingen! Vi svarer innen 24 timer.', da: 'Tak for din besked! Vi vender tilbage inden for 24 timer.', de: 'Vielen Dank für Ihre Nachricht! Wir antworten innerhalb von 24 Stunden.', fi: 'Kiitos viestistäsi! Palaamme asiaan 24 tunnin kuluessa.', nl: 'Bedankt voor uw bericht! We reageren binnen 24 uur.', fr: 'Merci pour votre message ! Nous vous répondrons sous 24 heures.', es: '¡Gracias por tu mensaje! Te responderemos en 24 horas.', pl: 'Dziękujemy za wiadomość! Odpowiemy w ciągu 24 godzin.' },
  'contact.faq': { sv: 'Kanske hittar du svaret i våra vanliga frågor.', en: 'You might find the answer in our FAQ.', no: 'Kanskje finner du svaret i våre vanlige spørsmål.', da: 'Måske finder du svaret i vores ofte stillede spørgsmål.', de: 'Vielleicht finden Sie die Antwort in unseren FAQ.', fi: 'Saatat löytää vastauksen usein kysytyistä kysymyksistämme.', nl: 'Misschien vindt u het antwoord in onze FAQ.', fr: 'Vous trouverez peut-être la réponse dans notre FAQ.', es: 'Quizás encuentres la respuesta en nuestras preguntas frecuentes.', pl: 'Może znajdziesz odpowiedź w naszych FAQ.' },
  'contact.viewfaq': { sv: 'Se vanliga frågor', en: 'View FAQ', no: 'Se vanlige spørsmål', da: 'Se ofte stillede spørgsmål', de: 'FAQ anzeigen', fi: 'Katso UKK', nl: 'Bekijk FAQ', fr: 'Voir FAQ', es: 'Ver preguntas frecuentes', pl: 'Zobacz FAQ' },

  // FAQ
  'faq.title': { sv: 'Vanliga frågor', en: 'Frequently Asked Questions', no: 'Vanlige spørsmål', da: 'Ofte stillede spørgsmål', de: 'Häufig gestellte Fragen', fi: 'Usein kysytyt kysymykset', nl: 'Veelgestelde vragen', fr: 'Questions fréquentes', es: 'Preguntas frecuentes', pl: 'Często zadawane pytania' },
  'faq.subtitle': { sv: 'Här hittar du svar på de vanligaste frågorna.', en: 'Here you\'ll find answers to the most common questions.', no: 'Her finner du svar på de vanligste spørsmålene.', da: 'Her finder du svar på de hyppigste spørgsmål.', de: 'Hier finden Sie Antworten auf die häufigsten Fragen.', fi: 'Täältä löydät vastaukset yleisimpiin kysymyksiin.', nl: 'Hier vindt u antwoorden op de meest gestelde vragen.', fr: 'Vous trouverez ici les réponses aux questions les plus courantes.', es: 'Aquí encontrarás respuestas a las preguntas más comunes.', pl: 'Tutaj znajdziesz odpowiedzi na najczęściej zadawane pytania.' },

  // Shipping Info
  'shipping.title': { sv: 'Leverans & Information', en: 'Delivery & Information', no: 'Levering & Informasjon', da: 'Levering & Information', de: 'Lieferung & Information', fi: 'Toimitus & Tietoa', nl: 'Levering & Informatie', fr: 'Livraison & Information', es: 'Entrega & Información', pl: 'Dostawa & Informacje' },
  'shipping.subtitle': { sv: 'Transparent information om hur vi levererar', en: 'Transparent information about how we deliver', no: 'Transparent informasjon om hvordan vi leverer', da: 'Transparent information om hvordan vi leverer', de: 'Transparente Informationen über unsere Lieferung', fi: 'Läpinäkyvää tietoa toimituksestamme', nl: 'Transparante informatie over onze levering', fr: 'Information transparente sur notre livraison', es: 'Información transparente sobre nuestra entrega', pl: 'Przejrzyste informacje o naszej dostawie' },

  // Newsletter
  'newsletter.title': { sv: 'Bli först med erbjudanden', en: 'Be first with offers', no: 'Bli først med tilbud', da: 'Bliv først med tilbud', de: 'Erhalten Sie Angebote zuerst', fi: 'Saa tarjoukset ensimmäisenä', nl: 'Ontvang aanbiedingen als eerste', fr: 'Soyez les premiers informés', es: 'Sé el primero en recibir ofertas', pl: 'Bądź pierwszy z ofertami' },
  'newsletter.description': { sv: 'Prenumerera på vårt nyhetsbrev och få exklusiva erbjudanden.', en: 'Subscribe to our newsletter and get exclusive offers.', no: 'Abonner på vårt nyhetsbrev og få eksklusive tilbud.', da: 'Abonner på vores nyhedsbrev og få eksklusive tilbud.', de: 'Abonnieren Sie unseren Newsletter und erhalten Sie exklusive Angebote.', fi: 'Tilaa uutiskirjeemme ja saat eksklusiivisia tarjouksia.', nl: 'Abonneer op onze nieuwsbrief en ontvang exclusieve aanbiedingen.', fr: 'Abonnez-vous à notre newsletter et recevez des offres exclusives.', es: 'Suscríbete a nuestro boletín y recibe ofertas exclusivas.', pl: 'Zapisz się na newsletter i otrzymuj ekskluzywne oferty.' },
  'newsletter.placeholder': { sv: 'Din e-postadress', en: 'Your email address', no: 'Din e-postadresse', da: 'Din e-mailadresse', de: 'Ihre E-Mail-Adresse', fi: 'Sähköpostiosoitteesi', nl: 'Uw e-mailadres', fr: 'Votre adresse e-mail', es: 'Tu correo electrónico', pl: 'Twój adres e-mail' },
  'newsletter.subscribe': { sv: 'Prenumerera', en: 'Subscribe', no: 'Abonner', da: 'Abonner', de: 'Abonnieren', fi: 'Tilaa', nl: 'Abonneren', fr: 'S\'abonner', es: 'Suscribirse', pl: 'Subskrybuj' },
  'newsletter.sending': { sv: 'Skickar...', en: 'Sending...', no: 'Sender...', da: 'Sender...', de: 'Senden...', fi: 'Lähetetään...', nl: 'Verzenden...', fr: 'Envoi...', es: 'Enviando...', pl: 'Wysyłanie...' },
  'newsletter.success': { sv: 'Tack för din prenumeration!', en: 'Thanks for subscribing!', no: 'Takk for abonnementet!', da: 'Tak for dit abonnement!', de: 'Danke für Ihr Abonnement!', fi: 'Kiitos tilauksestasi!', nl: 'Bedankt voor uw abonnement!', fr: 'Merci pour votre abonnement !', es: '¡Gracias por suscribirte!', pl: 'Dziękujemy za subskrypcję!' },
  'newsletter.successmessage': { sv: 'Du får snart ett välkomstmail.', en: 'You\'ll receive a welcome email soon.', no: 'Du vil snart motta en velkomst-e-post.', da: 'Du vil snart modtage en velkomst-e-mail.', de: 'Sie erhalten bald eine Willkommens-E-Mail.', fi: 'Saat pian tervetuliaissähköpostin.', nl: 'U ontvangt binnenkort een welkomstmail.', fr: 'Vous recevrez bientôt un e-mail de bienvenue.', es: 'Pronto recibirás un correo de bienvenida.', pl: 'Wkrótce otrzymasz powitalny e-mail.' },
  'newsletter.terms': { sv: 'Genom att prenumerera godkänner du våra villkor. Avsluta när som helst.', en: 'By subscribing you agree to our terms. Unsubscribe at any time.', no: 'Ved å abonnere godtar du våre vilkår. Avslutt når som helst.', da: 'Ved at abonnere accepterer du vores vilkår. Afmeld når som helst.', de: 'Mit dem Abonnement stimmen Sie unseren Bedingungen zu. Jederzeit abbestellbar.', fi: 'Tilaamalla hyväksyt ehtomme. Peruuta milloin tahansa.', nl: 'Door te abonneren gaat u akkoord met onze voorwaarden. Op elk moment opzegbaar.', fr: 'En vous abonnant, vous acceptez nos conditions. Désabonnement à tout moment.', es: 'Al suscribirte aceptas nuestros términos. Cancela en cualquier momento.', pl: 'Subskrybując, akceptujesz nasze warunki. Zrezygnuj w dowolnym momencie.' },

  // Footer extras (for languages not yet covered)
  'footer.payment': { sv: 'Betalsätt', en: 'Payment', no: 'Betaling', da: 'Betaling', de: 'Zahlung', fi: 'Maksu', nl: 'Betaling', fr: 'Paiement', es: 'Pago', pl: 'Płatność' },
  'footer.followus': { sv: 'Följ oss:', en: 'Follow us:', no: 'Følg oss:', da: 'Følg os:', de: 'Folgen Sie uns:', fi: 'Seuraa meitä:', nl: 'Volg ons:', fr: 'Suivez-nous:', es: 'Síguenos:', pl: 'Obserwuj nas:' },
  'footer.securepayment': { sv: 'Säker betalning med SSL', en: 'Secure SSL payment', no: 'Sikker betaling med SSL', da: 'Sikker betaling med SSL', de: 'Sichere SSL-Zahlung', fi: 'Turvallinen SSL-maksu', nl: 'Veilige SSL-betaling', fr: 'Paiement SSL sécurisé', es: 'Pago SSL seguro', pl: 'Bezpieczna płatność SSL' },
  'footer.freeshipping': { sv: 'Fri frakt över {threshold} kr', en: 'Free shipping over {threshold} SEK', no: 'Fri frakt over {threshold} kr', da: 'Gratis fragt over {threshold} kr', de: 'Kostenloser Versand ab {threshold} SEK', fi: 'Ilmainen toimitus yli {threshold} kr', nl: 'Gratis verzending boven {threshold} SEK', fr: 'Livraison gratuite dès {threshold} SEK', es: 'Envío gratis a partir de {threshold} SEK', pl: 'Darmowa dostawa od {threshold} SEK' },
  'footer.founded': { sv: 'Grundat 2026', en: 'Founded 2026', no: 'Grunnlagt 2026', da: 'Grundlagt 2026', de: 'Gegründet 2026', fi: 'Perustettu 2026', nl: 'Opgericht 2026', fr: 'Fondé en 2026', es: 'Fundado en 2026', pl: 'Założony w 2026' },
  'footer.response': { sv: 'Svar inom 48 timmar', en: 'Response within 48 hours', no: 'Svar innen 48 timer', da: 'Svar inden for 48 timer', de: 'Antwort innerhalb von 48 Stunden', fi: 'Vastaus 48 tunnin sisällä', nl: 'Reactie binnen 48 uur', fr: 'Réponse sous 48 heures', es: 'Respuesta en 48 horas', pl: 'Odpowiedź w ciągu 48 godzin' },
  'footer.europeandelivery': { sv: 'Leverans i Europa', en: 'European delivery', no: 'Europeisk levering', da: 'Europæisk levering', de: 'Europäische Lieferung', fi: 'Eurooppalainen toimitus', nl: 'Europese levering', fr: 'Livraison européenne', es: 'Entrega europea', pl: 'Dostawa europejska' },
  'footer.privacypolicy': { sv: 'Integritetspolicy', en: 'Privacy Policy', no: 'Personvernerklæring', da: 'Privatlivspolitik', de: 'Datenschutz', fi: 'Tietosuojakäytäntö', nl: 'Privacybeleid', fr: 'Politique de confidentialité', es: 'Política de privacidad', pl: 'Polityka prywatności' },
  'footer.terms': { sv: 'Villkor', en: 'Terms', no: 'Vilkår', da: 'Vilkår', de: 'AGB', fi: 'Ehdot', nl: 'Voorwaarden', fr: 'Conditions', es: 'Términos', pl: 'Regulamin' },
  'footer.returnspolicy': { sv: 'Returer', en: 'Returns', no: 'Returer', da: 'Returneringer', de: 'Rückgabe', fi: 'Palautukset', nl: 'Retourneren', fr: 'Retours', es: 'Devoluciones', pl: 'Zwroty' },
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
