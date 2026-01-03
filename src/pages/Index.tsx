import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import Hero from '@/components/sections/Hero';
import ShopifyProductGrid from '@/components/product/ShopifyProductGrid';
import About from '@/components/sections/About';

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <Hero />
        <ShopifyProductGrid />
        <About />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
