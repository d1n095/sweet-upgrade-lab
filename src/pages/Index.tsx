import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import Hero from '@/components/sections/Hero';
import ShopifyProductGrid from '@/components/product/ShopifyProductGrid';
import About from '@/components/sections/About';
import TrustBadges from '@/components/sections/TrustBadges';
import FAQ from '@/components/sections/FAQ';
import Newsletter from '@/components/sections/Newsletter';
import PromoPopup from '@/components/promo/PromoPopup';

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <Hero />
        <ShopifyProductGrid />
        <TrustBadges />
        <About />
        <FAQ />
        <Newsletter />
      </main>
      <Footer />
      <PromoPopup />
    </div>
  );
};

export default Index;
