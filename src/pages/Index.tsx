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
import MemberReviewsSection from '@/components/reviews/MemberReviewsSection';
import ProductSuggestions from '@/components/sections/ProductSuggestions';
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
        title={language === 'sv' ? '4thepeople - Giftfria Produkter för Europa' : '4thepeople - Toxin-Free Products for Europe'}
        description={language === 'sv' 
          ? 'Vi är inte det största företaget. Vi är det noggrannaste i vår research. Upptäck noggrant utvalda giftfria produkter till ärliga priser.'
          : "We're not the biggest company. We're the most thorough in our research. Discover carefully selected toxin-free products at honest prices."}
        keywords="giftfri, naturlig, kroppsvård, hållbart, europeisk, ekologisk, dropshipping"
        canonical="/"
        schemaType="Store"
      />
      <Header />
      <main>
        {/* Hero - Professional & brutally honest */}
        <Hero />
        
        {/* TrustBadges - Build trust immediately */}
        <TrustBadges />
        
        {/* Main product grid with lazy loading */}
        <Suspense fallback={<ProductGridSkeleton />}>
          <ShopifyProductGrid />
        </Suspense>
        
        {/* Shipping info - Transparency about delivery */}
        <ShippingInfo />
        
        {/* Member Reviews - Verified customer reviews or honest "no reviews yet" message */}
        <MemberReviewsSection />
        
        {/* About - Honest about dropshipping */}
        <About />
        
        {/* FAQ - Answer questions before purchase */}
        <FAQ />
        
        {/* Product Suggestions - Let users request products */}
        <ProductSuggestions />
        
        {/* Newsletter - Capture leads */}
        <Newsletter />
      </main>
      <Footer />
      <FloatingContactButton />
    </div>
  );
};

export default Index;