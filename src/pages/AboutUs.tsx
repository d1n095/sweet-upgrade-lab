import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Leaf, Heart, Shield, Users, Award } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import SEOHead from '@/components/seo/SEOHead';
import { supabase } from '@/integrations/supabase/client';
import { usePageSections } from '@/hooks/usePageSections';

interface TimelineEntry {
  id: string;
  year: string;
  title_sv: string;
  title_en: string | null;
  description_sv: string | null;
  description_en: string | null;
  display_order: number;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Leaf, Heart, Shield, Users, Award,
};

const AboutUs = () => {
  const { t, contentLang } = useLanguage();
  const lang = contentLang;
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const { sections, getSection, isSectionVisible, loading: sectionsLoading } = usePageSections('about');

  useEffect(() => {
    const fetchTimeline = async () => {
      const { data } = await supabase
        .from('timeline_entries')
        .select('*')
        .eq('is_visible', true)
        .order('display_order', { ascending: true });
      if (data) setTimeline(data as TimelineEntry[]);
    };
    fetchTimeline();
  }, []);

  const getLang = (sv: string | null, en: string | null) => (lang === 'sv' ? sv : en) || sv || '';

  const heroSection = getSection('hero');
  const promiseSection = getSection('promise');
  const valuesSection = getSection('values');

  // Get value sub-sections
  const valueSections = sections.filter(s => s.section_key.startsWith('value_') && s.is_visible);

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={({
          sv: 'Om oss – 4ThePeople',
          en: 'About Us – 4ThePeople',
          no: 'Om oss – 4ThePeople',
          da: 'Om os – 4ThePeople',
          de: 'Über uns – 4ThePeople',
          fi: 'Meistä – 4ThePeople',
          nl: 'Over ons – 4ThePeople',
          fr: 'À propos – 4ThePeople',
          es: 'Sobre nosotros – 4ThePeople',
          pl: 'O nas – 4ThePeople',
        } as Record<string, string>)[lang] ?? 'About Us – 4ThePeople'}
        description={heroSection ? getLang(heroSection.content_sv, heroSection.content_en) : t('about.page.intro')}
        keywords="om oss, hållbarhet, giftfritt, naturligt, about, sustainability"
        canonical="/about"
      />
      <Header />

      <main className="pt-24 pb-20">
        {/* Hero */}
        {isSectionVisible('hero') && (
          <section className="container mx-auto px-4 mb-20">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center max-w-3xl mx-auto"
            >
              <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-semibold mb-6">
                {heroSection ? getLang(heroSection.title_sv, heroSection.title_en).replace('4ThePeople', '') : t('about.page.about')}{' '}
                <span className="text-gradient">4ThePeople</span>
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed">
                {heroSection ? getLang(heroSection.content_sv, heroSection.content_en) : t('about.page.intro')}
              </p>
            </motion.div>
          </section>
        )}

        {/* Timeline / Vår resa */}
        {isSectionVisible('timeline') && timeline.length > 0 && (
          <section className="container mx-auto px-4 mb-20">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="font-display text-3xl md:text-4xl font-semibold text-center mb-14"
            >
              {getSection('timeline') ? getLang(getSection('timeline')!.title_sv, getSection('timeline')!.title_en) : (lang === 'sv' ? 'Vår resa' : 'Our Journey')}
            </motion.h2>

            <div className="max-w-3xl mx-auto relative">
              <div className="absolute left-6 md:left-1/2 top-0 bottom-0 w-px bg-border md:-translate-x-px" />
              {timeline.map((item, index) => {
                const isLeft = index % 2 === 0;
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                    className={`relative flex items-start gap-4 mb-12 last:mb-0 md:gap-8 ${isLeft ? 'md:flex-row' : 'md:flex-row-reverse'}`}
                  >
                    <div className="absolute left-0 md:left-1/2 md:-translate-x-1/2 z-10">
                      <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-display font-bold text-sm shadow-md">
                        {item.year}
                      </div>
                    </div>
                    <div className={`ml-20 md:ml-0 md:w-[calc(50%-2.5rem)] ${isLeft ? 'md:text-right md:pr-0' : 'md:text-left md:pl-0'}`}>
                      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                        <h3 className="font-display text-lg font-semibold mb-1.5">
                          {getLang(item.title_sv, item.title_en)}
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {getLang(item.description_sv, item.description_en)}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </section>
        )}

        {/* Promise */}
        {isSectionVisible('promise') && promiseSection && (
          <section className="container mx-auto px-4 mb-20">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-gradient-to-br from-primary/10 to-accent/10 rounded-3xl p-8 md:p-12 text-center max-w-3xl mx-auto"
            >
              {promiseSection.icon && iconMap[promiseSection.icon] && (() => {
                const IconComp = iconMap[promiseSection.icon!];
                return <IconComp className="w-12 h-12 text-primary mx-auto mb-6" />;
              })()}
              <h2 className="font-display text-2xl md:text-3xl font-semibold mb-4">
                {getLang(promiseSection.title_sv, promiseSection.title_en)}
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                {getLang(promiseSection.content_sv, promiseSection.content_en)}
              </p>
            </motion.div>
          </section>
        )}

        {/* Values */}
        {isSectionVisible('values') && valueSections.length > 0 && (
          <section className="bg-card border-y border-border/50 py-16">
            <div className="container mx-auto px-4">
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="font-display text-2xl md:text-3xl font-semibold text-center mb-10"
              >
                {valuesSection ? getLang(valuesSection.title_sv, valuesSection.title_en) : t('about.page.values')}
              </motion.h2>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 max-w-4xl mx-auto">
                {valueSections.map((value, index) => {
                  const IconComp = value.icon ? iconMap[value.icon] : null;
                  return (
                    <motion.div
                      key={value.id}
                      initial={{ opacity: 0, y: 16 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.08 }}
                      className="text-center"
                    >
                      {IconComp && (
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                          <IconComp className="w-6 h-6 text-primary" />
                        </div>
                      )}
                      <h3 className="font-display text-base font-semibold mb-1">
                        {getLang(value.title_sv, value.title_en)}
                      </h3>
                      <p className="text-muted-foreground text-xs leading-relaxed">
                        {getLang(value.content_sv, value.content_en)}
                      </p>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default AboutUs;
