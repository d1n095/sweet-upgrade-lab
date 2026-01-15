import { motion } from 'framer-motion';
import { Star, Quote, UserCircle } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { Card, CardContent } from '@/components/ui/card';

const Testimonials = () => {
  const { language } = useLanguage();

  const content = {
    sv: {
      badge: 'Kundernas röster',
      title: 'Vad våra kunder säger',
      subtitle: 'Läs om upplevelserna från våra nöjda kunder',
      testimonials: [
        {
          name: 'Anna L.',
          location: 'Stockholm',
          rating: 5,
          text: 'Fantastiska produkter! Jag märkte skillnad direkt efter att ha bytt till deras giftfria kroppsvård. Min hud har aldrig mått bättre.',
          product: 'Kroppsvård'
        },
        {
          name: 'Erik M.',
          location: 'Göteborg',
          rating: 5,
          text: 'Snabb leverans och bra kundservice. Produkterna är av hög kvalitet och jag uppskattar att allt är naturligt och hållbart.',
          product: 'Teknik'
        },
        {
          name: 'Maria S.',
          location: 'Malmö',
          rating: 5,
          text: 'Äntligen ett företag som bryr sig om både kvalitet och miljö! Deras hampakläder är otroligt sköna och håller verkligen.',
          product: 'Kläder'
        }
      ]
    },
    en: {
      badge: 'Customer voices',
      title: 'What our customers say',
      subtitle: 'Read about the experiences of our satisfied customers',
      testimonials: [
        {
          name: 'Anna L.',
          location: 'Stockholm',
          rating: 5,
          text: 'Amazing products! I noticed a difference immediately after switching to their toxin-free body care. My skin has never felt better.',
          product: 'Body Care'
        },
        {
          name: 'Erik M.',
          location: 'Gothenburg',
          rating: 5,
          text: 'Fast delivery and great customer service. The products are high quality and I appreciate that everything is natural and sustainable.',
          product: 'Tech'
        },
        {
          name: 'Maria S.',
          location: 'Malmö',
          rating: 5,
          text: 'Finally a company that cares about both quality and environment! Their hemp clothes are incredibly comfortable and really durable.',
          product: 'Clothing'
        }
      ]
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
            <Star className="w-4 h-4 fill-current" />
            {t.badge}
          </span>
          <h2 className="font-display text-3xl md:text-4xl font-semibold mb-3">
            {t.title}
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            {t.subtitle}
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {t.testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="h-full bg-card border-border/50 hover:border-primary/30 transition-colors">
                <CardContent className="p-6">
                  <Quote className="w-8 h-8 text-primary/30 mb-4" />
                  
                  <div className="flex gap-1 mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-primary text-primary" />
                    ))}
                  </div>
                  
                  <p className="text-foreground mb-6 leading-relaxed">
                    "{testimonial.text}"
                  </p>
                  
                  <div className="flex items-center gap-3 pt-4 border-t border-border/50">
                    <UserCircle className="w-10 h-10 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-foreground">{testimonial.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {testimonial.location} • {testimonial.product}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
