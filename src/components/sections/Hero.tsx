import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowDown, Star, ShieldCheck, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/context/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { PageSection } from '@/hooks/usePageSections';
import { storeConfig } from '@/config/storeConfig';

interface HeroProps {
  sections?: PageSection[];
  getSection?: (key: string) => PageSection | undefined;
  isSectionVisible?: (key: string) => boolean;
}

const Hero = ({ getSection, isSectionVisible }: HeroProps) => {
  const { t, contentLang } = useLanguage();
  const navigate = useNavigate();
  const [reviewCount, setReviewCount] = useState(0);
  const [avgRating, setAvgRating] = useState(0);

  const lang = contentLang;
  const getLang = (sv: string | null | undefined, en: string | null | undefined) =>
    (lang === 'sv' ? sv : en) || sv || '';

  const heroSection = getSection?.('hero');

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('reviews')
        .select('rating')
        .eq('is_approved', true);
      if (data && data.length > 0) {
        setReviewCount(data.length);
        setAvgRating(Math.round((data.reduce((s, r) => s + r.rating, 0) / data.length) * 10) / 10);
      }
    };
    load();
  }, []);

  const threshold = storeConfig.shipping.freeShippingThreshold;
  const trustItems = contentLang === 'sv'
    ? [
        { icon: ShieldCheck, text: 'Certifierade ingredienser' },
        { icon: Truck, text: `Fri frakt över ${threshold} kr` },
      ]
    : [
        { icon: ShieldCheck, text: 'Certified ingredients' },
        { icon: Truck, text: `Free shipping over ${threshold} kr` },
      ];

  const showBadges = isSectionVisible ? isSectionVisible('hero_badges') : true;

  if (isSectionVisible && !isSectionVisible('hero')) return null;

  return (
    <section className="relative min-h-[60vh] md:min-h-[75vh] flex items-center justify-center">
      <div className="absolute inset-0 bg-gradient-hero" />

      <div className="container mx-auto px-5 py-16 md:py-36 relative z-10">
        <div className="max-w-xl mx-auto text-center">
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
            className="text-[1.65rem] sm:text-4xl md:text-5xl font-semibold leading-[1.12] tracking-tight mb-4 md:mb-6 text-foreground"
          >
            {heroSection ? getLang(heroSection.title_sv, heroSection.title_en) : t('hero.title')}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.12, ease: [0.25, 0.1, 0.25, 1] }}
            className="text-sm sm:text-base text-muted-foreground/80 max-w-md mx-auto mb-6 md:mb-8 leading-relaxed"
          >
            {heroSection ? getLang(heroSection.content_sv, heroSection.content_en) : t('hero.subtitle')}
          </motion.p>

          {reviewCount > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.18 }}
              className="flex items-center justify-center gap-1.5 mb-8"
            >
              <div className="flex gap-px">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={`w-4 h-4 ${i < Math.round(avgRating) ? 'fill-yellow-400 text-yellow-400' : 'fill-muted text-muted-foreground/30'}`} />
                ))}
              </div>
              <span className="text-sm text-muted-foreground font-medium ml-1">
                {avgRating} · {reviewCount} {contentLang === 'sv' ? 'recensioner' : 'reviews'}
              </span>
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.24, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <Button
              size="lg"
              className="h-13 px-12 text-sm font-semibold rounded-full shadow-sm hover:shadow-md transition-all"
              onClick={() => navigate('/produkter')}
            >
              {t('hero.cta.primary')}
            </Button>
          </motion.div>

          {showBadges && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="flex items-center justify-center gap-6 mt-10"
            >
              {trustItems.map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-1.5 text-muted-foreground/60">
                  <Icon className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">{text}</span>
                </div>
              ))}
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="mt-16"
          >
            <button
              onClick={() => document.getElementById('philosophy')?.scrollIntoView({ behavior: 'smooth' })}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Scroll down"
            >
              <ArrowDown className="w-5 h-5 mx-auto animate-bounce" />
            </button>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
