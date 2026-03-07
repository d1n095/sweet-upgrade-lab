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
    <section className="py-8 md:py-10 border-b border-border/50">
      <div className="container mx-auto px-4">
        <div className="flex flex-wrap justify-center gap-x-10 gap-y-4">
          {badges.map((badge, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05, duration: 0.4 }}
              className="flex items-center gap-2.5"
            >
              <badge.icon className="w-4 h-4 text-accent" />
              <div>
                <span className="text-xs font-semibold text-foreground">
                  {t(badge.titleKey)}
                </span>
                <span className="text-xs text-muted-foreground ml-1.5">
                  {t(badge.descKey)}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TrustBadges;
