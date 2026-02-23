import { motion } from 'framer-motion';
import { Shield, Truck, RotateCcw, Mail, MapPin } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

const TrustBadges = () => {
  const { t } = useLanguage();

  const badges = [
    { icon: MapPin, titleKey: 'trust.founded', descKey: 'trust.founded.desc' },
    { icon: Truck, titleKey: 'trust.delivery', descKey: 'trust.delivery.desc' },
    { icon: Shield, titleKey: 'trust.payment', descKey: 'trust.payment.desc' },
    { icon: Mail, titleKey: 'trust.support', descKey: 'trust.support.desc' },
    { icon: RotateCcw, titleKey: 'trust.guarantee', descKey: 'trust.guarantee.desc' },
  ];

  return (
    <section className="py-10 md:py-14 bg-secondary/50 border-y border-border">
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
              <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <badge.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold text-sm mb-1">
                {t(badge.titleKey)}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t(badge.descKey)}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TrustBadges;
