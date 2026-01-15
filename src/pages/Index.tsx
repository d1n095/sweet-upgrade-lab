import { useEffect, Suspense, lazy } from 'react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import Hero from '@/components/sections/Hero';
import TrustBadges from '@/components/sections/TrustBadges';
import Bestsellers from '@/components/sections/Bestsellers';
import ProductGridSkeleton from '@/components/loading/ProductGridSkeleton';
import Testimonials from '@/components/sections/Testimonials';
import ShippingInfo from '@/components/sections/ShippingInfo';
import ImpactSection from '@/components/sections/ImpactSection';
import BuilderSection from '@/components/sections/BuilderSection';
import About from '@/components/sections/About';
import RecentlyViewed from '@/components/engagement/RecentlyViewed';
import FAQ from '@/components/sections/FAQ';
import Newsletter from '@/components/sections/Newsletter';
import PromoPopup from '@/components/promo/PromoPopup';
import ExitIntentPopup from '@/components/engagement/ExitIntentPopup';
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
        title={language === 'sv' ? '4thepeople - Giftfria Produkter för ett Renare Liv' : '4thepeople - Toxin-Free Products for a Cleaner Life'}
        description={language === 'sv' 
          ? 'Upptäck giftfria kroppsvårdsprodukter, hållbar teknik och naturliga kläder. Allt för ett renare och hälsosammare liv.'
          : 'Discover toxin-free body care, sustainable tech and natural clothing. Everything for a cleaner, healthier life.'}
        keywords="giftfri, naturlig, kroppsvård, tvål, tandkräm, deodorant, powerbank, ekologiska kläder, hållbart"
        canonical="/"
        schemaType="Store"
      />
      <Header />
      <main>
        {/* Hero - grab attention */}
        <Hero />
        
        {/* TrustBadges - build trust immediately after hero */}
        <TrustBadges />
        
        {/* Bestsellers - show popular products early */}
        <Bestsellers />
        
        {/* Main product grid with lazy loading */}
        <Suspense fallback={<ProductGridSkeleton />}>
          <ShopifyProductGrid />
        </Suspense>
        
        {/* Testimonials - social proof after seeing products */}
        <Testimonials />
        
        {/* Shipping info - crucial for dropshipping trust */}
        <ShippingInfo />
        
        {/* Impact section - show social impact */}
        <ImpactSection />
        
        {/* Builder section - recruit workers */}
        <BuilderSection />
        
        {/* About - build brand connection */}
        <About />
        
        {/* Recently viewed - personalized recommendations */}
        <RecentlyViewed />
        
        {/* FAQ - answer questions before purchase */}
        <FAQ />
        
        {/* Newsletter - capture leads last */}
        <Newsletter />
      </main>
      <Footer />
      <PromoPopup />
      <ExitIntentPopup />
      <FloatingContactButton />
    </div>
  );
};

export default Index;
