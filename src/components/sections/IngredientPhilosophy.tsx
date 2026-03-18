import { motion } from 'framer-motion';
import { Search, ShieldCheck, FlaskConical } from 'lucide-react';
import { useLanguage, getContentLang } from '@/context/LanguageContext';
import { PageSection } from '@/hooks/usePageSections';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  FlaskConical, ShieldCheck, Search,
};

interface IngredientPhilosophyProps {
  sections?: PageSection[];
  getSection?: (key: string) => PageSection | undefined;
  isSectionVisible?: (key: string) => boolean;
}

const IngredientPhilosophy = ({ sections = [], getSection, isSectionVisible }: IngredientPhilosophyProps) => {
  const { language } = useLanguage();
  const lang = getContentLang(language);

  const getLang = (sv: string | null | undefined, en: string | null | undefined) =>
    (lang === 'sv' ? sv : en) || sv || '';

  const titleSection = getSection?.('philosophy');
  const steps = sections
    .filter(s => s.section_key.startsWith('philosophy_step_') && s.is_visible)
    .sort((a, b) => a.display_order - b.display_order);

  const fallbackSteps = lang === 'sv'
    ? [
        { icon: FlaskConical, title: 'Ingrediensanalys', desc: 'Vi granskar varje ingredienslista och undviker skadliga ämnen.' },
        { icon: ShieldCheck, title: 'Certifieringar', desc: 'Internationella certifieringar från oberoende organisationer.' },
        { icon: Search, title: 'Användarrecensioner', desc: 'Vi analyserar globala omdömen för verklig kvalitet.' },
      ]
    : [
        { icon: FlaskConical, title: 'Ingredient analysis', desc: 'We review every ingredient list and avoid harmful substances.' },
        { icon: ShieldCheck, title: 'Certifications', desc: 'International certifications from independent organisations.' },
        { icon: Search, title: 'User reviews', desc: 'We analyse global reviews for real-world quality.' },
      ];

  if (isSectionVisible && !isSectionVisible('philosophy')) return null;

  const titleText = titleSection
    ? getLang(titleSection.title_sv, titleSection.title_en)
    : (lang === 'sv' ? 'Hur vi väljer produkter' : 'How we select products');

  const renderSteps = steps.length > 0 ? steps : null;

  return (
    <section id="philosophy" className="py-28 md:py-36">
      <div className="container mx-auto px-5">
        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-2xl md:text-3xl font-semibold text-center mb-20 text-foreground"
        >
          {titleText}
        </motion.h2>

        <div className="grid md:grid-cols-3 gap-6 md:gap-8 max-w-3xl mx-auto">
          {renderSteps
            ? renderSteps.map((step, i) => {
                const IconComp = step.icon ? iconMap[step.icon] : null;
                return (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.08 }}
                    className="text-center bg-card border border-border/50 rounded-2xl p-7 transition-all duration-200 hover:-translate-y-1 hover:shadow-[var(--shadow-elevated)]"
                  >
                    {IconComp && (
                      <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center mx-auto mb-6">
                        <IconComp className="w-5 h-5 text-foreground" />
                      </div>
                    )}
                    <h3 className="text-sm font-semibold mb-2.5 text-foreground">
                      {getLang(step.title_sv, step.title_en)}
                    </h3>
                    <p className="text-[13px] text-muted-foreground/80 leading-relaxed">
                      {getLang(step.content_sv, step.content_en)}
                    </p>
                  </motion.div>
                );
              })
            : fallbackSteps.map((step, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className="text-center bg-card border border-border/50 rounded-2xl p-7 transition-all duration-200 hover:-translate-y-1 hover:shadow-[var(--shadow-elevated)]"
                >
                  <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center mx-auto mb-6">
                    <step.icon className="w-5 h-5 text-foreground" />
                  </div>
                  <h3 className="text-sm font-semibold mb-2.5 text-foreground">{step.title}</h3>
                  <p className="text-[13px] text-muted-foreground/80 leading-relaxed">{step.desc}</p>
                </motion.div>
              ))}
        </div>
      </div>
    </section>
  );
};

export default IngredientPhilosophy;
