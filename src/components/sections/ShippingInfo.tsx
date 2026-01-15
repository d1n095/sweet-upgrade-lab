import { motion } from 'framer-motion';
import { Truck, Shield, RotateCcw, Clock } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { storeConfig } from '@/config/storeConfig';

const ShippingInfo = () => {
  const { language } = useLanguage();

  const content = {
    sv: {
      title: 'Trygg och snabb leverans',
      subtitle: 'Vi skickar från EU för snabb leverans och säker handel',
      shipping: {
        title: 'Snabb leverans',
        description: storeConfig.shipping.deliveryTime.sv
      },
      freeShipping: {
        title: 'Fri frakt',
        description: `Vid köp över ${storeConfig.shipping.freeShippingThreshold} kr`
      },
      returns: {
        title: `${storeConfig.returns.period} dagars öppet köp`,
        description: 'Enkla returer – ingen krångel'
      },
      secure: {
        title: 'Säker betalning',
        description: 'Klarna, kort, Swish & mer'
      }
    },
    en: {
      title: 'Safe and fast delivery',
      subtitle: 'We ship from EU for fast delivery and secure shopping',
      shipping: {
        title: 'Fast delivery',
        description: storeConfig.shipping.deliveryTime.en
      },
      freeShipping: {
        title: 'Free shipping',
        description: `On orders over ${storeConfig.shipping.freeShippingThreshold} SEK`
      },
      returns: {
        title: `${storeConfig.returns.period} days return policy`,
        description: 'Easy returns – no hassle'
      },
      secure: {
        title: 'Secure payment',
        description: 'Klarna, card, Swish & more'
      }
    }
  };

  const t = content[language];

  const features = [
    { icon: Truck, ...t.shipping },
    { icon: Clock, ...t.freeShipping },
    { icon: RotateCcw, ...t.returns },
    { icon: Shield, ...t.secure }
  ];

  return (
    <section className="py-16 bg-primary/5 border-y border-primary/10">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <h2 className="font-display text-2xl md:text-3xl font-semibold mb-2">
            {t.title}
          </h2>
          <p className="text-muted-foreground">{t.subtitle}</p>
        </motion.div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="flex flex-col items-center text-center p-4"
            >
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <feature.icon className="w-7 h-7 text-primary" />
              </div>
              <h3 className="font-semibold mb-1">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ShippingInfo;
