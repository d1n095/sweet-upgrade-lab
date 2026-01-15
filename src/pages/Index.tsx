import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import Hero from '@/components/sections/Hero';
import ShopifyProductGrid from '@/components/product/ShopifyProductGrid';
import Bestsellers from '@/components/sections/Bestsellers';
import About from '@/components/sections/About';
import TrustBadges from '@/components/sections/TrustBadges';
import Testimonials from '@/components/sections/Testimonials';
import FAQ from '@/components/sections/FAQ';
import Newsletter from '@/components/sections/Newsletter';
import PromoPopup from '@/components/promo/PromoPopup';
import ExitIntentPopup from '@/components/engagement/ExitIntentPopup';
import RecentlyViewed from '@/components/engagement/RecentlyViewed';
import FloatingContactButton from '@/components/trust/FloatingContactButton';
import SEOHead from '@/components/seo/SEOHead';
import { useLanguage } from '@/context/LanguageContext';

const Index = () => {
  const { language } = useLanguage();
  
  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={language === 'sv' ? '4thepeople - Giftfria Produkter för ett Renare Liv' : '4thepeople - Toxin-Free Products for a Cleaner Life'}
        description={language === 'sv' 
          ? 'Upptäck giftfria kroppsvårdsprodukter, hållbar teknik och naturliga kläder. Allt för ett renare och hälsosammare liv.'
          : 'Discover toxin-free body care, sustainable tech and natural clothing. Everything for a cleaner, healthier life.'}
        keywords="giftfri, naturlig, kroppsvård, tvål, tandkräm, deodorant, powerbank, ekologiska kläder, hållbart"
        canonical="/"
      />
      <Header />
      <main>
        <Hero />
        <Bestsellers />
        <ShopifyProductGrid />
        <RecentlyViewed />
        <Testimonials />
        <TrustBadges />
        <About />
        <FAQ />
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
