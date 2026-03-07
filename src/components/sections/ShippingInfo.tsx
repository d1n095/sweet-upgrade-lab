import { motion } from 'framer-motion';
import { Package, Truck, RotateCcw, MessageCircle } from 'lucide-react';
import { useLanguage, getContentLang } from '@/context/LanguageContext';
import { storeConfig } from '@/config/storeConfig';

const ShippingInfo = () => {
  const { t, language } = useLanguage();

  const content = {
    sv: {
      items: [
        { icon: Package, title: 'Leveranstid', value: `${storeConfig.shipping.deliveryDays} arbetsdagar`, detail: 'Pålitliga leverantörer' },
        { icon: Truck, title: 'Leveranskostnad', value: `${storeConfig.shipping.cost} kr`, detail: `Gratis över ${storeConfig.shipping.freeShippingThreshold} kr` },
        { icon: RotateCcw, title: 'Öppet köp', value: `${storeConfig.returns.period} dagar`, detail: 'Enkla returer' },
        { icon: MessageCircle, title: 'Support', value: '< 24 timmar', detail: storeConfig.contact.email }
      ],
    },
    en: {
      items: [
        { icon: Package, title: 'Delivery', value: `${storeConfig.shipping.deliveryDays} business days`, detail: 'Reliable suppliers' },
        { icon: Truck, title: 'Shipping cost', value: `${storeConfig.shipping.cost} SEK`, detail: `Free over ${storeConfig.shipping.freeShippingThreshold} SEK` },
        { icon: RotateCcw, title: 'Returns', value: `${storeConfig.returns.period} days`, detail: 'Easy returns' },
        { icon: MessageCircle, title: 'Support', value: '< 24 hours', detail: storeConfig.contact.email }
      ],
    }
  };

  const c = content[getContentLang(language)];

  return (
    <section className="py-12 md:py-16">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
          {c.items.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.08 }}
              className="text-center p-4"
            >
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-3">
                <item.icon className="w-5 h-5 text-accent" />
              </div>
              <p className="text-xs text-muted-foreground mb-0.5">{item.title}</p>
              <p className="text-sm font-semibold text-foreground mb-0.5">{item.value}</p>
              <p className="text-xs text-muted-foreground">{item.detail}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ShippingInfo;
