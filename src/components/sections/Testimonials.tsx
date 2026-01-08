import { motion } from 'framer-motion';
import { Star, Quote } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

const testimonials = [
  {
    name: 'Anna Lindström',
    location: 'Stockholm',
    rating: 5,
    text: {
      sv: 'Fantastiska produkter! Har testat många naturliga alternativ men 4thepeople har verkligen levererat. Min hud har aldrig mått bättre.',
      en: 'Amazing products! I\'ve tried many natural alternatives but 4thepeople has truly delivered. My skin has never felt better.'
    },
    product: { sv: 'Hudvårdsprodukter', en: 'Skincare products' }
  },
  {
    name: 'Erik Johansson',
    location: 'Göteborg',
    rating: 5,
    text: {
      sv: 'Äntligen hittade jag en butik som tar hållbarhet på allvar. Kvaliteten på kläderna är otrolig och kundservicen är toppen!',
      en: 'Finally found a store that takes sustainability seriously. The clothing quality is incredible and customer service is top notch!'
    },
    product: { sv: 'Hampakläder', en: 'Hemp clothing' }
  },
  {
    name: 'Maria Svensson',
    location: 'Malmö',
    rating: 5,
    text: {
      sv: 'Snabb leverans och produkterna överträffade mina förväntningar. Kommer definitivt att handla igen!',
      en: 'Fast delivery and the products exceeded my expectations. Will definitely shop again!'
    },
    product: { sv: 'Hygienprodukter', en: 'Hygiene products' }
  },
  {
    name: 'Johan Karlsson',
    location: 'Uppsala',
    rating: 5,
    text: {
      sv: 'Som någon som är känslig för kemikalier har 4thepeople varit en livräddare. Älskar att allt är naturligt och giftfritt.',
      en: 'As someone sensitive to chemicals, 4thepeople has been a lifesaver. Love that everything is natural and toxin-free.'
    },
    product: { sv: 'Naturlig tvål', en: 'Natural soap' }
  }
];

const Testimonials = () => {
  const { language } = useLanguage();

  return (
    <section className="py-20 md:py-32">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="font-display text-3xl md:text-5xl font-bold mb-4">
            {language === 'sv' ? 'Vad våra' : 'What our'}{' '}
            <span className="text-gradient">{language === 'sv' ? 'kunder säger' : 'customers say'}</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {language === 'sv' 
              ? 'Över 1 000+ nöjda kunder har valt 4thepeople för ett renare liv'
              : 'Over 1,000+ satisfied customers have chosen 4thepeople for a cleaner life'
            }
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="glass-card p-6 flex flex-col h-full"
            >
              <Quote className="w-8 h-8 text-primary/30 mb-4" />
              
              <p className="text-muted-foreground text-sm mb-4 flex-1">
                "{testimonial.text[language]}"
              </p>
              
              <div className="flex items-center gap-1 mb-3">
                {Array.from({ length: testimonial.rating }).map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-primary text-primary" />
                ))}
              </div>
              
              <div className="border-t border-border pt-4">
                <p className="font-semibold text-sm">{testimonial.name}</p>
                <p className="text-xs text-muted-foreground">{testimonial.location}</p>
                <p className="text-xs text-primary mt-1">{testimonial.product[language]}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
