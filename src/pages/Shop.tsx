import { motion } from 'framer-motion';
import { useLanguage } from '@/context/LanguageContext';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import ShopifyProductGrid from '@/components/product/ShopifyProductGrid';
import { storeConfig } from '@/config/storeConfig';
import SEOHead from '@/components/seo/SEOHead';

const Shop = () => {
  const { language } = useLanguage();

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={language === 'sv' ? 'Butik - Alla Produkter' : 'Shop - All Products'}
        description={language === 'sv' 
          ? 'Utforska vårt sortiment av hållbara, giftfria produkter. Kroppsvård, teknik och naturliga kläder.'
          : 'Explore our range of sustainable, toxin-free products. Body care, tech and natural clothing.'}
        keywords="butik, shop, giftfri, naturlig, kroppsvård, powerbank, ekologiska kläder"
        canonical="/shop"
      />
      <Header />
      
      <main className="pt-24 pb-20">
        <div className="container mx-auto px-4">
          {/* Page Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <h1 className="font-display text-4xl md:text-5xl font-semibold mb-4">
              {language === 'sv' ? 'Alla Produkter' : 'All Products'}
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-6">
              {language === 'sv' 
                ? 'Upptäck vårt sortiment av hållbara och naturliga produkter'
                : 'Discover our range of sustainable and natural products'}
            </p>
            
            {/* Delivery info banner */}
            <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-5 py-2.5 text-sm">
              <span className="font-medium">{storeConfig.shipping.deliveryTime[language as 'sv' | 'en']}</span>
              <span className="text-muted-foreground">•</span>
              <span>
                {language === 'sv' 
                  ? `Fri frakt över ${storeConfig.shipping.freeShippingThreshold} kr`
                  : `Free shipping over ${storeConfig.shipping.freeShippingThreshold} kr`}
              </span>
            </div>
          </motion.div>

          {/* Product Grid - includes its own category filters */}
          <ShopifyProductGrid />
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Shop;
