import { motion } from 'framer-motion';
import { Truck } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { storeConfig } from '@/config/storeConfig';
import SEOHead from '@/components/seo/SEOHead';

const ShippingPolicy = () => {
  const { language } = useLanguage();

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={language === 'sv' ? 'Fraktinformation' : 'Shipping Information'}
        description={language === 'sv' 
          ? `Fri frakt över ${storeConfig.shipping.freeShippingThreshold} kr. ${storeConfig.shipping.deliveryTime.sv}. Leverans till hela Europa.`
          : `Free shipping over ${storeConfig.shipping.freeShippingThreshold} kr. ${storeConfig.shipping.deliveryTime.en}. Delivery throughout Europe.`}
        canonical="/policies/shipping"
      />
      <Header />
      <main className="pt-24 pb-20">
        <div className="container mx-auto px-4 max-w-3xl">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Truck className="w-4 h-4" />
              {language === 'sv' ? 'Frakt' : 'Shipping'}
            </span>
            <h1 className="font-display text-4xl md:text-5xl font-semibold mb-8">
              {language === 'sv' ? 'Fraktinformation' : 'Shipping Information'}
            </h1>
            
            <div className="prose prose-invert max-w-none space-y-6 text-muted-foreground">
              <div className="bg-card border border-border/50 rounded-xl p-6 not-prose">
                <div className="grid grid-cols-2 gap-4">
                  <div><span className="text-sm">{language === 'sv' ? 'Fraktkostnad' : 'Shipping'}</span><p className="font-semibold text-foreground">{storeConfig.shipping.cost} kr</p></div>
                  <div><span className="text-sm">{language === 'sv' ? 'Fri frakt över' : 'Free over'}</span><p className="font-semibold text-primary">{storeConfig.shipping.freeShippingThreshold} kr</p></div>
                  <div><span className="text-sm">{language === 'sv' ? 'Leveranstid' : 'Delivery'}</span><p className="font-semibold text-foreground">{storeConfig.shipping.deliveryTime[language]}</p></div>
                </div>
              </div>
              
              <h2 className="font-display text-xl font-semibold text-foreground">{language === 'sv' ? 'Leveransområde' : 'Delivery Area'}</h2>
              <p>{language === 'sv' ? 'Vi levererar till hela Europa. Produkterna skickas från EU-lager för snabb leverans.' : 'We deliver throughout Europe. Products ship from EU warehouses for fast delivery.'}</p>
              
              <h2 className="font-display text-xl font-semibold text-foreground">{language === 'sv' ? 'Spårning' : 'Tracking'}</h2>
              <p>{language === 'sv' ? 'Du får spårningsinformation via e-post när din order har skickats.' : 'You\'ll receive tracking information via email when your order ships.'}</p>
            </div>
          </motion.div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ShippingPolicy;
