import { motion } from 'framer-motion';
import { MessageCircle, ArrowRight, Mail, Clock } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const Testimonials = () => {
  const { language } = useLanguage();

  const content = {
    sv: {
      title: 'Vi är nya, men vi växer med ditt förtroende',
      subtitle: 'Din feedback är vår framtid',
      cards: [
        {
          icon: MessageCircle,
          title: 'Har du handlat av oss?',
          description: 'Dela gärna din erfarenhet. Ditt ärliga omdöme hjälper andra att fatta rätt beslut – och oss att bli bättre.'
        },
        {
          icon: Clock,
          title: 'Svar inom 24 timmar',
          description: 'Har du frågor innan du beställer? Vi svarar personligen på alla meddelanden – ingen robot, bara vi.'
        },
        {
          icon: Mail,
          title: 'Öppen dialog',
          description: 'Vi tror på transparens. Skriv till oss om du undrar något – vi döljer inget.'
        }
      ],
      ctaPrimary: 'Beställ nu',
      ctaSecondary: 'Kontakta oss',
      footer: 'Inga fejkade omdömen. Inga köpta recensioner. Bara ärlig feedback från riktiga kunder – när vi får dem.'
    },
    en: {
      title: "We're new, but we grow with your trust",
      subtitle: 'Your feedback is our future',
      cards: [
        {
          icon: MessageCircle,
          title: 'Have you ordered from us?',
          description: 'Please share your experience. Your honest review helps others make the right decision – and helps us improve.'
        },
        {
          icon: Clock,
          title: 'Response within 24 hours',
          description: 'Have questions before ordering? We personally answer all messages – no bots, just us.'
        },
        {
          icon: Mail,
          title: 'Open dialogue',
          description: "We believe in transparency. Write to us if you're wondering about anything – we hide nothing."
        }
      ],
      ctaPrimary: 'Order now',
      ctaSecondary: 'Contact us',
      footer: "No fake reviews. No paid testimonials. Just honest feedback from real customers – when we get them."
    }
  };

  const t = content[language as 'sv' | 'en'] || content.en;

  return (
    <section className="py-20 bg-secondary/30">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="font-display text-3xl md:text-4xl font-semibold mb-3">
            {t.title}
          </h2>
          <p className="text-muted-foreground text-lg">
            {t.subtitle}
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-10">
          {t.cards.map((card, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="bg-card border border-border rounded-2xl p-6 text-center hover:border-primary/30 transition-all duration-300 hover:-translate-y-1"
            >
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center">
                <card.icon className="w-7 h-7 text-primary" />
              </div>
              
              <h3 className="font-semibold text-lg mb-3 text-foreground">
                {card.title}
              </h3>
              
              <p className="text-muted-foreground leading-relaxed text-sm">
                {card.description}
              </p>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="text-center space-y-6"
        >
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/shop">
              <Button size="lg" className="group">
                {t.ctaPrimary}
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link to="/contact">
              <Button variant="outline" size="lg">
                {t.ctaSecondary}
              </Button>
            </Link>
          </div>
          <p className="text-sm text-muted-foreground italic max-w-lg mx-auto">
            {t.footer}
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default Testimonials;