import { motion } from 'framer-motion';
import { Search, ShieldCheck, FlaskConical } from 'lucide-react';
import { useLanguage, getContentLang } from '@/context/LanguageContext';

const IngredientPhilosophy = () => {
  const { language } = useLanguage();
  const lang = getContentLang(language);

  const content = {
    sv: {
      title: 'Hur vi väljer produkter',
      steps: [
        { icon: FlaskConical, title: 'Ingrediensanalys', desc: 'Vi granskar varje ingredienslista och undviker kända skadliga ämnen.' },
        { icon: ShieldCheck, title: 'Certifieringar', desc: 'Internationella certifieringar från oberoende organisationer.' },
        { icon: Search, title: 'Användarrecensioner', desc: 'Vi analyserar globala omdömen för att säkerställa verklig kvalitet.' },
      ],
    },
    en: {
      title: 'How we select products',
      steps: [
        { icon: FlaskConical, title: 'Ingredient analysis', desc: 'We review every ingredient list and avoid known harmful substances.' },
        { icon: ShieldCheck, title: 'Certifications', desc: 'International certifications from independent organisations.' },
        { icon: Search, title: 'User reviews', desc: 'We analyse global reviews to ensure real-world quality.' },
      ],
    },
  };

  const t = content[lang];

  return (
    <section className="py-16 md:py-24">
      <div className="container mx-auto px-4">
        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-2xl md:text-3xl font-bold text-center mb-12 text-foreground"
        >
          {t.title}
        </motion.h2>

        <div className="grid md:grid-cols-3 gap-8 max-w-3xl mx-auto">
          {t.steps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="text-center"
            >
              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
                <step.icon className="w-4.5 h-4.5 text-foreground" />
              </div>
              <h3 className="text-sm font-semibold mb-2 text-foreground">{step.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default IngredientPhilosophy;
