import { motion } from 'framer-motion';
import { Shield, Leaf, RotateCcw, Truck } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

const TrustBadges = () => {
  const { language } = useLanguage();

  const badges = [
    {
      icon: Shield,
      title: { sv: 'Säker betalning', en: 'Secure payment' },
      description: { sv: 'Krypterad checkout med SSL', en: 'SSL encrypted checkout' }
    },
    {
      icon: Leaf,
      title: { sv: '100% Naturligt', en: '100% Natural' },
      description: { sv: 'Inga gifter eller kemikalier', en: 'No toxins or chemicals' }
    },
    {
      icon: RotateCcw,
      title: { sv: '30 dagars öppet köp', en: '30-day returns' },
      description: { sv: 'Enkelt & smidigt', en: 'Easy & hassle-free' }
    },
    {
      icon: Truck,
      title: { sv: 'Snabb leverans', en: 'Fast delivery' },
      description: { sv: 'Direkt till din dörr', en: 'Straight to your door' }
    }
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    visible: { 
      opacity: 1, 
      y: 0,
      scale: 1,
      transition: { duration: 0.5, ease: "easeOut" }
    }
  };

  return (
    <section className="py-20 md:py-28 bg-gradient-warm relative overflow-hidden">
      {/* Decorative elements */}
      <div className="decorative-circle w-[400px] h-[400px] bg-primary/5 -top-32 -right-32" />
      <div className="decorative-circle w-[300px] h-[300px] bg-accent/5 -bottom-20 -left-20" />
      
      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-semibold mb-5">
            {language === 'sv' ? 'Varför välja ' : 'Why choose '}
            <span className="text-gradient">4thepeople</span>?
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            {language === 'sv' 
              ? 'Vi tror på hållbarhet, kvalitet och transparens i allt vi gör.'
              : 'We believe in sustainability, quality, and transparency in everything we do.'
            }
          </p>
        </motion.div>

        <motion.div 
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-5 md:gap-6"
        >
          {badges.map((badge, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              className="card-soft p-6 md:p-8 text-center flex flex-col items-center group hover:shadow-elevated transition-all duration-500"
            >
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                <badge.icon className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-display font-semibold text-base md:text-lg mb-2">
                {badge.title[language]}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {badge.description[language]}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default TrustBadges;