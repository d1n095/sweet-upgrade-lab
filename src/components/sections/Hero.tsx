import { motion } from 'framer-motion';
import { ArrowRight, Check, Leaf } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/context/LanguageContext';
import { Link } from 'react-router-dom';

const Hero = () => {
  const { t, language } = useLanguage();
  
  const features = [
    { text: language === 'sv' ? 'Snabb leverans i Sverige' : 'Fast delivery in Sweden' },
    { text: language === 'sv' ? '30 dagars öppet köp' : '30-day returns' },
    { text: language === 'sv' ? 'Personlig kundservice' : 'Personal customer service' },
    { text: language === 'sv' ? 'Noggrant utvalt sortiment' : 'Carefully curated selection' },
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
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1, 
      y: 0,
      transition: { duration: 0.6 }
    }
  };

  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden bg-gradient-to-b from-secondary/50 via-background to-background">
      {/* Subtle decorative elements */}
      <div className="absolute top-20 right-[10%] w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-20 left-[10%] w-48 h-48 bg-accent/5 rounded-full blur-3xl" />
      
      <div className="container mx-auto px-4 py-20 md:py-28 relative z-10">
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="max-w-3xl mx-auto text-center"
        >
          {/* Badge */}
          <motion.div
            variants={itemVariants}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-sm font-medium text-primary mb-8"
          >
            <Leaf className="w-4 h-4" />
            <span>{t('hero.badge')}</span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={itemVariants}
            className="font-display text-4xl sm:text-5xl md:text-6xl font-semibold leading-[1.1] mb-6 text-foreground"
          >
            {t('hero.title')}
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            variants={itemVariants}
            className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            {t('hero.subtitle')}
          </motion.p>

          {/* Features list */}
          <motion.div
            variants={itemVariants}
            className="flex flex-wrap justify-center gap-x-6 gap-y-3 mb-10"
          >
            {features.map((feature, index) => (
              <div key={index} className="flex items-center gap-2 text-sm text-foreground/80">
                <Check className="w-4 h-4 text-primary" />
                <span>{feature.text}</span>
              </div>
            ))}
          </motion.div>

          {/* CTAs */}
          <motion.div
            variants={itemVariants}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Button
              size="lg"
              className="h-12 px-8 text-base font-semibold gap-2 rounded-lg shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300 group"
              onClick={() => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' })}
            >
              {t('hero.cta.products')}
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Link to="/about">
              <Button
                variant="outline"
                size="lg"
                className="h-12 px-8 text-base rounded-lg border-2"
              >
                {t('hero.cta.contact')}
              </Button>
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;