import { motion } from 'framer-motion';
import { ArrowRight, Leaf, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/context/LanguageContext';
import { Link } from 'react-router-dom';

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
      {/* Subtle decorative elements */}
      <div className="absolute top-20 right-[10%] w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-20 left-[10%] w-48 h-48 bg-accent/5 rounded-full blur-3xl" />
      
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
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;