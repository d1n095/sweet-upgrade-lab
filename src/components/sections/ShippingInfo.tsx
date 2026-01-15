import { motion } from 'framer-motion';
import { Package, Truck, RotateCcw, MessageCircle } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { storeConfig } from '@/config/storeConfig';

const ShippingInfo = () => {
  const { language } = useLanguage();

  const content = {
    sv: {
      title: 'Leverans & Information',
      subtitle: 'Transparent information om hur vi levererar',
      items: [
        {
          icon: Package,
          title: 'Leveranstid',
          description: `${storeConfig.shipping.deliveryDays} arbetsdagar`,
          detail: 'Vi skickar från pålitliga leverantörer'
        },
        {
          icon: Truck,
          title: 'Leveranskostnad',
          description: `${storeConfig.shipping.cost} kr`,
          detail: `Gratis vid köp över ${storeConfig.shipping.freeShippingThreshold} kr`
        },
        {
          icon: RotateCcw,
          title: 'Nöjdhetsgaranti',
          description: `${storeConfig.returns.period} dagars öppet köp`,
          detail: 'Enkla returer utan krångel'
        },
        {
          icon: MessageCircle,
          title: 'Personlig service',
          description: 'Svar inom 24 timmar',
          detail: storeConfig.contact.email
        }
      ],
      footer: 'Spårningsnummer skickas när din order skeppas. Du får SMS-avisering vid leverans.'
    },
    en: {
      title: 'Delivery & Information',
      subtitle: 'Transparent information about how we deliver',
      items: [
        {
          icon: Package,
          title: 'Delivery time',
          description: `${storeConfig.shipping.deliveryDays} business days`,
          detail: 'We ship from reliable suppliers'
        },
        {
          icon: Truck,
          title: 'Delivery cost',
          description: `${storeConfig.shipping.cost} SEK`,
          detail: `Free on orders over ${storeConfig.shipping.freeShippingThreshold} SEK`
        },
        {
          icon: RotateCcw,
          title: 'Satisfaction guarantee',
          description: `${storeConfig.returns.period}-day return policy`,
          detail: 'Easy returns without hassle'
        },
        {
          icon: MessageCircle,
          title: 'Personal service',
          description: 'Reply within 24 hours',
          detail: storeConfig.contact.email
        }
      ],
      footer: 'Tracking number sent when your order ships. SMS notification on delivery.'
    }
  };

  const t = content[language];

  return (
    <section className="py-16 md:py-20 bg-secondary/30">
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

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 max-w-5xl mx-auto">
          {t.items.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="bg-background border border-border rounded-xl p-5 text-center"
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <item.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-1">{item.title}</h3>
              <p className="text-primary font-medium text-lg mb-1">{item.description}</p>
              <p className="text-xs text-muted-foreground">{item.detail}</p>
            </motion.div>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="text-center text-sm text-muted-foreground mt-8"
        >
          {t.footer}
        </motion.p>
      </div>
    </section>
  );
};

export default ShippingInfo;