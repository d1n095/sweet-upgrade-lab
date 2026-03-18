import { motion } from 'framer-motion';
import { useLanguage } from '@/context/LanguageContext';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import DbProductGrid from '@/components/product/DbProductGrid';
import { storeConfig } from '@/config/storeConfig';
import SEOHead from '@/components/seo/SEOHead';

const Shop = () => {
  const { t, contentLang } = useLanguage();

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={t('shop.title')}
        description={t('shop.subtitle')}
        keywords="butik, shop, giftfri, naturlig, kroppsvård, powerbank, ekologiska kläder"
        canonical="/produkter"
      />
      <Header />
      
      <main className="pt-24 pb-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <h1 className="font-display text-4xl md:text-5xl font-semibold mb-4">
              {t('shop.title')}
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-6">
              {t('shop.subtitle')}
            </p>
            <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-5 py-2.5 text-sm">
              <span className="font-medium">{storeConfig.shipping.deliveryTime[contentLang]}</span>
              <span className="text-muted-foreground">•</span>
              <span>
                {t('shop.freeshipping').replace('{threshold}', String(storeConfig.shipping.freeShippingThreshold))}
              </span>
            </div>
          </motion.div>

          <DbProductGrid />
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Shop;
