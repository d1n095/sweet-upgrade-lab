import { motion } from 'framer-motion';
import { Star, Sparkles, Heart, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const Testimonials = () => {
  const { language } = useLanguage();

  const content = {
    sv: {
      badge: 'Äkta omdömen',
      title: 'Vi är nya – och stolta över det',
      subtitle: 'Våra första kunder kommer snart att dela sina upplevelser här. Kanske blir du en av dem?',
      cards: [
        {
          icon: Heart,
          title: 'Bli vår första kund',
          description: 'Var med från början och hjälp oss forma framtidens giftfria produkter. Ditt omdöme kommer att visas här.'
        },
        {
          icon: Star,
          title: 'Ärlighet framför allt',
          description: 'Vi visar aldrig falska omdömen. När vi får riktiga kundrecensioner ser du dem här – ofiltrerade.'
        },
        {
          icon: Sparkles,
          title: 'Din röst räknas',
          description: 'Som tidig kund har du möjlighet att påverka vårt sortiment och vår utveckling. Vi lyssnar.'
        }
      ],
      cta: 'Bli vår första kund',
      footer: 'Kom tillbaka snart för att läsa äkta omdömen!'
    },
    en: {
      badge: 'Authentic reviews',
      title: "We're new – and proud of it",
      subtitle: 'Our first customers will soon share their experiences here. Maybe you will be one of them?',
      cards: [
        {
          icon: Heart,
          title: 'Be our first customer',
          description: 'Be there from the start and help us shape the future of toxin-free products. Your review will be displayed here.'
        },
        {
          icon: Star,
          title: 'Honesty above all',
          description: "We never show fake reviews. When we get real customer reviews, you'll see them here – unfiltered."
        },
        {
          icon: Sparkles,
          title: 'Your voice matters',
          description: 'As an early customer, you have the opportunity to influence our range and development. We listen.'
        }
      ],
      cta: 'Be our first customer',
      footer: 'Come back soon to read authentic reviews!'
    }
  };

  const t = content[language];

  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            <Star className="w-4 h-4" />
            {t.badge}
          </span>
          <h2 className="font-display text-3xl md:text-4xl font-semibold mb-3">
            {t.title}
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
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
            >
              <Card className="h-full bg-card/50 border-border/50 hover:border-primary/30 transition-all duration-300 hover:-translate-y-1">
                <CardContent className="p-6 text-center">
                  <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary/15 to-accent/15 flex items-center justify-center">
                    <card.icon className="w-7 h-7 text-primary" />
                  </div>
                  
                  <h3 className="font-semibold text-lg mb-3 text-foreground">
                    {card.title}
                  </h3>
                  
                  <p className="text-muted-foreground leading-relaxed">
                    {card.description}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="text-center space-y-4"
        >
          <Link to="/shop">
            <Button 
              size="lg" 
              className="bg-gradient-to-r from-primary to-primary/80 hover:opacity-90 group"
            >
              {t.cta}
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
          <p className="text-sm text-muted-foreground italic">
            {t.footer}
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default Testimonials;