import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowDown, Star, ShieldCheck, Truck, Sparkles, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/context/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { PageSection } from '@/hooks/usePageSections';

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
  const [freeThreshold, setFreeThreshold] = useState(500);

  const lang = contentLang;
  const getLang = (sv: string | null | undefined, en: string | null | undefined) =>
    (lang === 'sv' ? sv : en) || sv || '';

  const heroSection = getSection?.('hero');

  useEffect(() => {
    const load = async () => {
      const [reviewRes, settingsRes] = await Promise.all([
        supabase.from('reviews').select('rating').eq('is_approved', true),
        supabase.from('store_settings').select('key, text_value').in('key', ['free_shipping_threshold']),
      ]);
      if (reviewRes.data && reviewRes.data.length > 0) {
        setReviewCount(reviewRes.data.length);
        setAvgRating(Math.round((reviewRes.data.reduce((s, r) => s + r.rating, 0) / reviewRes.data.length) * 10) / 10);
      }
      if (settingsRes.data) {
        for (const row of settingsRes.data) {
          const val = Number(row.text_value);
          if (row.key === 'free_shipping_threshold' && Number.isFinite(val)) setFreeThreshold(val);
        }
      }
    };
    load();
  }, []);

  const trustItems = contentLang === 'sv'
    ? [
        { icon: ShieldCheck, text: 'Certifierade ingredienser' },
        { icon: Truck, text: `Fri frakt över ${freeThreshold} kr` },
      ]
    : [
        { icon: ShieldCheck, text: 'Certified ingredients' },
        { icon: Truck, text: `Free shipping over ${freeThreshold} kr` },
      ];

  const showBadges = isSectionVisible ? isSectionVisible('hero_badges') : true;

  if (isSectionVisible && !isSectionVisible('hero')) return null;

  return (
    <section className="relative min-h-[70vh] md:min-h-[85vh] flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-gradient-hero" />

      {/* Ambient gold orb */}
      <motion.div
        aria-hidden
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.6, ease: 'easeOut' }}
        className="absolute -top-40 left-1/2 -translate-x-1/2 w-[720px] h-[720px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, hsl(var(--gold) / 0.22) 0%, transparent 60%)' }}
      />

      {/* Floating shimmer dots */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1.5 h-1.5 rounded-full bg-gold/60"
            style={{ left: `${15 + i * 14}%`, top: `${25 + (i % 3) * 20}%` }}
            animate={{ y: [0, -16, 0], opacity: [0.3, 0.9, 0.3] }}
            transition={{ duration: 4 + i * 0.5, repeat: Infinity, ease: 'easeInOut', delay: i * 0.3 }}
          />
        ))}
      </div>

      <div className="container mx-auto px-5 py-20 md:py-40 relative z-10">
        <div className="max-w-2xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 mb-6 chip-gold"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gold opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-gold" />
            </span>
            {contentLang === 'sv' ? 'NYTT · FÖRKÖP ÖPPET' : 'NEW · PREBUY OPEN'}
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
            className="text-4xl sm:text-6xl md:text-7xl font-bold leading-[1.02] tracking-tight mb-5 md:mb-7 text-foreground"
          >
            {heroSection ? getLang(heroSection.title_sv, heroSection.title_en) : t('hero.title')}
            <span className="block gradient-text-gold mt-2">
              {contentLang === 'sv' ? 'utan kompromiss.' : 'no compromise.'}
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="text-base sm:text-lg text-muted-foreground max-w-lg mx-auto mb-8 leading-relaxed"
          >
            {heroSection ? getLang(heroSection.content_sv, heroSection.content_en) : t('hero.subtitle')}
          </motion.p>

          {reviewCount > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.22 }}
              className="flex items-center justify-center gap-1.5 mb-8"
            >
              <div className="flex gap-px">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={`w-4 h-4 ${i < Math.round(avgRating) ? 'fill-gold text-gold' : 'fill-muted text-muted-foreground/30'}`} />
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
            transition={{ duration: 0.6, delay: 0.28 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <Button
                size="lg"
                className="h-12 px-8 text-sm font-semibold rounded-full bg-foreground text-background hover:bg-foreground/90 shadow-lg gap-2"
                onClick={() => navigate('/produkter')}
              >
                <Zap className="w-4 h-4" />
                {t('hero.cta.primary')}
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <Button
                variant="outline"
                size="lg"
                className="h-12 px-6 text-sm font-semibold rounded-full border-gold/40 text-foreground hover:bg-gold/10 gap-2"
                onClick={() => navigate('/produkter?prebuy=1')}
              >
                <Sparkles className="w-4 h-4 text-gold" />
                {contentLang === 'sv' ? 'Se förköpen' : 'See prebuys'}
              </Button>
            </motion.div>
          </motion.div>

          {showBadges && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-10"
            >
              {trustItems.map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-1.5 text-muted-foreground/70">
                  <Icon className="w-3.5 h-3.5 text-gold" />
                  <span className="text-xs font-medium">{text}</span>
                </div>
              ))}
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="mt-12 md:mt-16"
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

      {/* Gold marquee ticker */}
      <div className="absolute bottom-0 left-0 right-0 border-y border-gold/20 bg-background/60 backdrop-blur-sm overflow-hidden">
        <div className="flex whitespace-nowrap animate-[marquee_28s_linear_infinite] py-2.5">
          {[...Array(2)].map((_, r) => (
            <div key={r} className="flex items-center shrink-0 gap-8 px-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {[
                contentLang === 'sv' ? '⚡ Förköp öppet' : '⚡ Prebuy open',
                contentLang === 'sv' ? '✦ Fri frakt över 500 kr' : '✦ Free shipping over 500 kr',
                contentLang === 'sv' ? '◆ Giftfria ingredienser' : '◆ Toxin-free ingredients',
                contentLang === 'sv' ? '☀ Europeisk kvalitet' : '☀ European quality',
                contentLang === 'sv' ? '★ 4.9 av 5 från kunder' : '★ 4.9 of 5 from customers',
              ].map((txt, i) => (
                <span key={`${r}-${i}`} className="flex items-center gap-8">
                  <span className="text-gold">{txt}</span>
                  <span className="text-gold/40">·</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Hero;
