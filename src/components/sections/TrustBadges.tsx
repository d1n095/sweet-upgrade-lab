import { motion } from 'framer-motion';
import { Shield, Truck, RotateCcw, Mail, MapPin } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { storeConfig } from '@/config/storeConfig';

const TrustBadges = () => {
  const { language } = useLanguage();

  const badges = [
    {
      icon: MapPin,
      title: { sv: 'Grundat 2026', en: 'Founded 2026' },
      description: { sv: 'Transparent business', en: 'Transparent business' }
    },
    {
      icon: Truck,
      title: { sv: 'Leverans i Norden', en: 'Nordic delivery' },
      description: { sv: `Gratis över ${storeConfig.shipping.freeShippingThreshold} kr`, en: `Free over ${storeConfig.shipping.freeShippingThreshold} SEK` }
    },
    {
      icon: Shield,
      title: { sv: 'Säkra betalningar', en: 'Secure payments' },
      description: { sv: 'Köparskydd via Klarna', en: 'Buyer protection via Klarna' }
    },
    {
      icon: Mail,
      title: { sv: 'Personlig support', en: 'Personal support' },
      description: { sv: 'Svar inom 24h', en: 'Reply within 24h' }
    },
    {
      icon: RotateCcw,
      title: { sv: 'Nöjdhetsgaranti', en: 'Satisfaction guarantee' },
      description: { sv: '30 dagars öppet köp', en: '30-day returns' }
    }
  ];

  return (
    <section className="py-12 md:py-16 bg-secondary/50 border-y border-border">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 md:gap-6">
          {badges.map((badge, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05, duration: 0.4 }}
              className="flex flex-col items-center text-center p-4"
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <badge.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-sm mb-1">
                {badge.title[language]}
              </h3>
              <p className="text-xs text-muted-foreground">
                {badge.description[language]}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TrustBadges;