import { useEffect } from 'react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import Hero from '@/components/sections/Hero';
import IngredientPhilosophy from '@/components/sections/IngredientPhilosophy';
import AboutCompact from '@/components/sections/AboutCompact';
import FloatingContactButton from '@/components/trust/FloatingContactButton';
import SEOHead from '@/components/seo/SEOHead';
import { useLanguage, getContentLang } from '@/context/LanguageContext';
import { trackPageView } from '@/utils/analytics';

const Index = () => {
  const { language } = useLanguage();
  const lang = getContentLang(language);

  useEffect(() => {
    trackPageView('home', language);
  }, [language]);

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={lang === 'sv' ? '4thepeople - Giftfria Produkter för Europa' : '4thepeople - Toxin-Free Products for Europe'}
        description={lang === 'sv'
          ? 'Noggrant utvalda giftfria produkter till ärliga priser.'
          : 'Carefully curated toxin-free products at honest prices.'}
        keywords="giftfri, naturlig, kroppsvård, hållbart, europeisk, ekologisk"
        canonical="/"
        schemaType="Store"
      />
      <Header />
      <main>
        <Hero />
        <IngredientPhilosophy />
        <AboutCompact />
      </main>
      <Footer />
      <FloatingContactButton />
    </div>
  );
};

export default Index;
