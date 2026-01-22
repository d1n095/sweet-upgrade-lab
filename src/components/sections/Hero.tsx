import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, Leaf, Check, X, Sparkles, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/context/LanguageContext';
import { Link } from 'react-router-dom';

// Custom hook for parallax effect
const useParallax = (multiplier: number) => {
  const { scrollY } = useScroll();
  return useTransform(scrollY, [0, 500], [0, 100 * multiplier]);
};

const Hero = () => {
  const { language } = useLanguage();
  
  const content = {
    sv: {
      badge: 'Grundat 2026',
      title: 'Giftfria Produkter som Faktiskt Fungerar',
      subtitle: 'Vi är inte det största företaget. Vi är det noggrannaste i vår research. Varje produkt vi säljer är noggrant utvald efter ingrediensanalys, internationella certifieringar och användarrecensioner.',
      wePromise: [
        'Noggrann research av varje produkt',
        'Ärlig information om leveranstider (7-10 arbetsdagar)',
        'Personlig support på svenska och engelska',
      ],
      weDont: [
        'Mirakelprodukter som botar allt',
        'Blixtsnabb leverans från andra sidan jorden',
      ],
      features: [
        { icon: '🚚', text: 'Leverans i Europa' },
        { icon: '💬', text: 'Transparent business' },
        { icon: '✨', text: 'Grundat 2026' },
      ],
      ctaPrimary: 'Shoppa giftfritt nu',
      ctaSecondary: 'Läs vår utvärderingsprocess',
    },
    en: {
      badge: 'Founded 2026',
      title: 'Toxin-Free Products That Actually Work',
      subtitle: "We're not the biggest company. We're the most thorough in our research. Every product we sell is carefully selected based on ingredient analysis, international certifications and user reviews.",
      wePromise: [
        'Thorough research on every product',
        'Honest delivery info (7-10 business days)',
        'Personal support in Swedish and English',
      ],
      weDont: [
        'Miracle products that cure everything',
        'Lightning-fast delivery from the other side of the world',
      ],
      features: [
        { icon: '🚚', text: 'European delivery' },
        { icon: '💬', text: 'Transparent business' },
        { icon: '✨', text: 'Founded 2026' },
      ],
      ctaPrimary: 'Shop toxin-free now',
      ctaSecondary: 'Read our evaluation process',
    }
  };

  const t = content[language as 'sv' | 'en'] || content.en;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.1,
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1, 
      y: 0,
      transition: { duration: 0.5 }
    }
  };

  return (
    <section className="relative min-h-[95vh] flex items-center justify-center overflow-hidden bg-gradient-to-b from-secondary/30 via-background to-background">
      {/* Parallax floating elements */}
      <motion.div
        style={{ y: useParallax(0.3) }}
        className="absolute top-20 right-[10%] w-64 h-64 bg-primary/5 rounded-full blur-3xl"
      />
      <motion.div
        style={{ y: useParallax(0.5) }}
        className="absolute bottom-20 left-[10%] w-48 h-48 bg-accent/5 rounded-full blur-3xl"
      />
      <motion.div
        style={{ y: useParallax(0.2) }}
        className="absolute top-1/3 left-[5%] w-32 h-32 bg-primary/8 rounded-full blur-2xl"
      />
      <motion.div
        style={{ y: useParallax(0.4) }}
        className="absolute bottom-1/3 right-[5%] w-24 h-24 bg-accent/8 rounded-full blur-2xl"
      />
      
      {/* Floating decorative icons */}
      <motion.div
        style={{ y: useParallax(0.6) }}
        animate={{ 
          y: [0, -10, 0],
          rotate: [0, 5, 0]
        }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-32 left-[15%] w-12 h-12 rounded-xl bg-primary/10 backdrop-blur-sm flex items-center justify-center opacity-60"
      >
        <Leaf className="w-6 h-6 text-primary" />
      </motion.div>
      <motion.div
        style={{ y: useParallax(0.35) }}
        animate={{ 
          y: [0, 15, 0],
          rotate: [0, -5, 0]
        }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="absolute top-48 right-[20%] w-10 h-10 rounded-full bg-accent/10 backdrop-blur-sm flex items-center justify-center opacity-50"
      >
        <Sparkles className="w-5 h-5 text-accent" />
      </motion.div>
      <motion.div
        style={{ y: useParallax(0.45) }}
        animate={{ 
          y: [0, -8, 0],
          rotate: [0, 10, 0]
        }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        className="absolute bottom-40 left-[25%] w-8 h-8 rounded-lg bg-primary/15 backdrop-blur-sm flex items-center justify-center opacity-40"
      >
        <Heart className="w-4 h-4 text-primary" />
      </motion.div>
      
      <div className="container mx-auto px-4 py-16 md:py-24 relative z-10">
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="max-w-4xl mx-auto text-center"
        >
          {/* Badge */}
          <motion.div
            variants={itemVariants}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-sm font-medium text-primary mb-6"
          >
            <Leaf className="w-4 h-4" />
            <span>{t.badge}</span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={itemVariants}
            className="font-display text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-semibold leading-[1.1] mb-5 text-foreground"
          >
            {t.title}
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            variants={itemVariants}
            className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed"
          >
            {t.subtitle}
          </motion.p>


          {/* Features badges */}
          <motion.div
            variants={itemVariants}
            className="flex flex-wrap justify-center gap-3 mb-8"
          >
            {t.features.map((feature, index) => (
              <div key={index} className="flex items-center gap-2 text-sm font-medium text-foreground/90 px-4 py-2 bg-secondary/50 rounded-full border border-border/50">
                <span>{feature.icon}</span>
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
              className="h-14 px-10 text-base font-semibold gap-2 rounded-xl shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300 group"
              onClick={() => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' })}
            >
              {t.ctaPrimary}
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Link to="/how-it-works">
              <Button
                variant="outline"
                size="lg"
                className="h-14 px-10 text-base rounded-xl border-2 hover:bg-secondary/50"
              >
                {t.ctaSecondary}
              </Button>
            </Link>
          </motion.div>

          {/* Scroll indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 0.5 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2"
          >
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              className="flex flex-col items-center gap-2 cursor-pointer"
              onClick={() => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' })}
            >
              <span className="text-xs text-muted-foreground font-medium">
                {language === 'sv' ? 'Scrolla för produkter' : 'Scroll for products'}
              </span>
              <div className="w-6 h-10 rounded-full border-2 border-muted-foreground/30 flex items-start justify-center p-1.5">
                <motion.div
                  animate={{ y: [0, 12, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                  className="w-1.5 h-1.5 rounded-full bg-primary"
                />
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;