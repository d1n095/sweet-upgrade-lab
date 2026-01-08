import { motion } from 'framer-motion';
import { Award, Users, Leaf, Heart } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

const About = () => {
  const { t, language } = useLanguage();
  
  const stats = [
    { icon: Users, value: '1,000+', label: t('about.stat.customers') },
    { icon: Award, value: '100%', label: t('about.stat.natural') },
    { icon: Leaf, value: language === 'sv' ? 'Giftfritt' : 'Toxin-free', label: t('about.stat.toxinfree') },
    { icon: Heart, value: '24/7', label: t('about.stat.service') },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.3 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.6, ease: "easeOut" }
    }
  };

  return (
    <section id="about" className="section-padding bg-card relative overflow-hidden">
      {/* Decorative elements */}
      <div className="decorative-circle w-[500px] h-[500px] bg-accent/5 top-0 right-0" />
      <div className="decorative-circle w-[300px] h-[300px] bg-primary/5 bottom-0 left-0" />
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          {/* Content */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="order-2 lg:order-1"
          >
            <span className="inline-block text-sm font-semibold text-accent uppercase tracking-wider mb-4">
              {language === 'sv' ? 'Om oss' : 'About us'}
            </span>
            <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-semibold mb-8 leading-tight">
              {t('about.title')}{' '}
              <span className="text-gradient">4thepeople?</span>
            </h2>
            <p className="text-muted-foreground text-lg mb-6 leading-relaxed">
              {t('about.description1')}
            </p>
            <p className="text-muted-foreground text-lg mb-10 leading-relaxed">
              {t('about.description2')}
            </p>

            {/* Stats */}
            <motion.div 
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="grid grid-cols-2 gap-4"
            >
              {stats.map((stat) => (
                <motion.div
                  key={stat.label}
                  variants={itemVariants}
                  className="p-5 rounded-2xl bg-secondary/50 border border-border/30 group hover:bg-secondary/70 transition-colors duration-300"
                >
                  <stat.icon className="w-6 h-6 text-primary mb-3 group-hover:scale-110 transition-transform" />
                  <div className="font-display text-2xl md:text-3xl font-semibold mb-1">{stat.value}</div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>

          {/* Visual */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="order-1 lg:order-2 relative"
          >
            <div className="relative aspect-[4/5] max-w-lg mx-auto">
              {/* Decorative background layers */}
              <div className="absolute inset-4 rounded-3xl bg-gradient-to-br from-accent/20 to-accent/5 transform rotate-3" />
              <div className="absolute inset-4 rounded-3xl bg-gradient-to-br from-primary/15 to-primary/5 transform -rotate-3" />
              
              {/* Main card */}
              <div className="relative z-10 w-full h-full rounded-3xl bg-gradient-to-b from-secondary to-card border border-border/50 overflow-hidden flex items-center justify-center shadow-elevated">
                <div className="text-center p-10">
                  <motion.div 
                    animate={{ y: [0, -10, 0] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    className="w-28 h-28 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center"
                  >
                    <Leaf className="w-14 h-14 text-accent" />
                  </motion.div>
                  <h3 className="font-display text-2xl font-semibold mb-3">{t('about.visual.title')}</h3>
                  <p className="text-muted-foreground leading-relaxed max-w-xs mx-auto">
                    {t('about.visual.description')}
                  </p>
                </div>
              </div>
              
              {/* Floating accent */}
              <motion.div
                animate={{ y: [0, -15, 0], rotate: [0, 5, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -bottom-4 -right-4 w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center backdrop-blur-sm"
              >
                <Heart className="w-10 h-10 text-primary" />
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default About;