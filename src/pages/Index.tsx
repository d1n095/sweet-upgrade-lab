import { useEffect } from 'react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import Hero from '@/components/sections/Hero';
import IngredientPhilosophy from '@/components/sections/IngredientPhilosophy';
import AboutCompact from '@/components/sections/AboutCompact';
import HomepageBestsellers from '@/components/sections/HomepageBestsellers';
import HomepageReviews from '@/components/sections/HomepageReviews';
import FloatingContactButton from '@/components/trust/FloatingContactButton';
import SEOHead from '@/components/seo/SEOHead';
import { useLanguage, getContentLang } from '@/context/LanguageContext';
import { trackPageView } from '@/utils/analytics';
import { useStoreSettings } from '@/stores/storeSettingsStore';
import { usePageSections, PageSection } from '@/hooks/usePageSections';

const Index = () => {
  const { language } = useLanguage();
  const lang = getContentLang(language);
  const {
    homepageBestsellers,
    homepageReviews,
    homepagePhilosophy,
    homepageAbout,
    isLoaded,
    fetchSettings,
  } = useStoreSettings();

  // Single fetch for all home page sections — passed down to children
  const { sections, loading: sectionsLoading, getSection, isSectionVisible } = usePageSections('home');

  useEffect(() => {
    trackPageView('home', language);
  }, [language]);

  useEffect(() => {
    if (!isLoaded) fetchSettings();
  }, [isLoaded, fetchSettings]);

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
        {homepagePhilosophy !== false && (
          <Hero sections={sections} getSection={getSection} isSectionVisible={isSectionVisible} />
        )}
        {homepagePhilosophy && (
          <IngredientPhilosophy sections={sections} getSection={getSection} isSectionVisible={isSectionVisible} />
        )}
        {homepageBestsellers && <HomepageBestsellers />}
        {homepageReviews && <HomepageReviews />}
        {homepageAbout && (
          <AboutCompact sections={sections} getSection={getSection} isSectionVisible={isSectionVisible} />
        )}
      </main>
      <Footer />
      <FloatingContactButton />
    </div>
  );
};

export default Index;
