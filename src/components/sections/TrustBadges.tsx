import { motion } from 'framer-motion';
import { Shield, Truck, RotateCcw, Mail, MapPin } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

const TrustBadges = () => {
  const { t } = useLanguage();

  const badges = [
    { icon: MapPin, label: t('trust.founded') },
    { icon: Truck, label: t('trust.delivery') },
    { icon: Shield, label: t('trust.payment') },
    { icon: Mail, label: t('trust.support') },
    { icon: RotateCcw, label: t('trust.guarantee') },
  ];

  return (
    <section className="py-6 border-b border-border/40">
      <div className="container mx-auto px-4">
        <div className="flex flex-wrap justify-center gap-x-8 gap-y-3">
          {badges.map((badge, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.04, duration: 0.4 }}
              className="flex items-center gap-2 text-xs text-muted-foreground"
            >
              <badge.icon className="w-3.5 h-3.5" />
              <span>{badge.label}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TrustBadges;
