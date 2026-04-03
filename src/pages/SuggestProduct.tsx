import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import ProductSuggestions from '@/components/sections/ProductSuggestions';
import SEOHead from '@/components/seo/SEOHead';
import { useLanguage } from '@/context/LanguageContext';

const SuggestProduct = () => {
  const { language } = useLanguage();

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={({
          sv: 'Önska produkt',
          en: 'Suggest a Product',
          no: 'Foreslå et produkt',
          da: 'Foreslå et produkt',
          de: 'Produkt vorschlagen',
          fi: 'Ehdota tuotetta',
          nl: 'Product voorstellen',
          fr: 'Suggérer un produit',
          es: 'Sugerir un producto',
          pl: 'Zaproponuj produkt',
        } as Record<string, string>)[language] ?? 'Suggest a Product'}
        description={({
          sv: 'Hjälp oss hitta produkter du vill ha. Vi samlar in önskemål och förhandlar med leverantörer för bättre priser.',
          en: 'Help us find products you want. We collect requests and negotiate with suppliers for better prices.',
          no: 'Hjelp oss å finne produkter du ønsker. Vi samler inn forespørsler og forhandler med leverandører.',
          da: 'Hjælp os med at finde produkter du ønsker. Vi indsamler forespørgsler og forhandler med leverandører.',
          de: 'Helfen Sie uns, Produkte zu finden, die Sie möchten. Wir sammeln Anfragen und verhandeln mit Lieferanten.',
          fi: 'Auta meitä löytämään haluamasi tuotteet. Keräämme pyyntöjä ja neuvottelemme toimittajien kanssa.',
          nl: 'Help ons producten te vinden die u wilt. We verzamelen verzoeken en onderhandelen met leveranciers.',
          fr: 'Aidez-nous à trouver les produits que vous souhaitez. Nous recueillons des demandes et négocions avec les fournisseurs.',
          es: 'Ayúdenos a encontrar los productos que desea. Recopilamos solicitudes y negociamos con proveedores.',
          pl: 'Pomóż nam znaleźć produkty, których chcesz. Zbieramy prośby i negocjujemy z dostawcami.',
        } as Record<string, string>)[language] ?? 'Help us find products you want. We collect requests and negotiate with suppliers for better prices.'}
      />
      <Header />
      <main className="pt-20">
        <ProductSuggestions />
      </main>
      <Footer />
    </div>
  );
};

export default SuggestProduct;
