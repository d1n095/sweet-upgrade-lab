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
        title={language === 'sv' ? 'Önska produkt - 4thepeople' : 'Suggest Product - 4thepeople'}
        description={language === 'sv' 
          ? 'Hjälp oss hitta produkter du vill ha. Vi samlar in önskemål och förhandlar med leverantörer för bättre priser.'
          : 'Help us find products you want. We collect requests and negotiate with suppliers for better prices.'}
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
