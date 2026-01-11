import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import Hero from '@/components/sections/Hero';
import ShopifyProductGrid from '@/components/product/ShopifyProductGrid';
import About from '@/components/sections/About';
import TrustBadges from '@/components/sections/TrustBadges';
import FAQ from '@/components/sections/FAQ';
import Newsletter from '@/components/sections/Newsletter';
import PromoPopup from '@/components/promo/PromoPopup';
import ExitIntentPopup from '@/components/engagement/ExitIntentPopup';
import RecentlyViewed from '@/components/engagement/RecentlyViewed';
import FloatingContactButton from '@/components/trust/FloatingContactButton';

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <Hero />
        <ShopifyProductGrid />
        <RecentlyViewed />
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
