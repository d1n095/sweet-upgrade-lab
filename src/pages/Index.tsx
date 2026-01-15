import { useEffect, Suspense, lazy } from 'react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import Hero from '@/components/sections/Hero';
import TrustBadges from '@/components/sections/TrustBadges';
import ProductGridSkeleton from '@/components/loading/ProductGridSkeleton';
import ShippingInfo from '@/components/sections/ShippingInfo';
import About from '@/components/sections/About';
import FAQ from '@/components/sections/FAQ';
import Newsletter from '@/components/sections/Newsletter';
import FloatingContactButton from '@/components/trust/FloatingContactButton';
import SEOHead from '@/components/seo/SEOHead';
import { useLanguage } from '@/context/LanguageContext';
import { trackPageView } from '@/utils/analytics';

// Lazy load the product grid for better performance
const ShopifyProductGrid = lazy(() => import('@/components/product/ShopifyProductGrid'));

const Index = () => {
  const { language } = useLanguage();

  // Track page view
  useEffect(() => {
    trackPageView('home', language);
  }, [language]);
  
  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={language === 'sv' ? '4thepeople - Giftfria Produkter för Sverige' : '4thepeople - Toxin-Free Products for Sweden'}
        description={language === 'sv' 
          ? 'Vi är inte det största företaget. Vi är det noggrannaste. Upptäck noggrant utvalda giftfria produkter till ärliga priser.'
          : "We're not the biggest company. We're the most careful. Discover carefully selected toxin-free products at honest prices."}
        keywords="giftfri, naturlig, kroppsvård, hållbart, svensk, ekologisk"
        canonical="/"
        schemaType="Store"
      />
      <Header />
      <main>
        {/* Hero - Professional & honest */}
        <Hero />
        
        {/* TrustBadges - Build trust immediately */}
        <TrustBadges />
        
        {/* Main product grid with lazy loading */}
        <Suspense fallback={<ProductGridSkeleton />}>
          <ShopifyProductGrid />
        </Suspense>
        
        {/* Shipping info - Transparency */}
        <ShippingInfo />
        
        {/* About - Honest startup story */}
        <About />
        
        {/* FAQ - Answer questions before purchase */}
        <FAQ />
        
        {/* Newsletter - Capture leads */}
        <Newsletter />
      </main>
      <Footer />
      <FloatingContactButton />
    </div>
  );
};

export default Index;