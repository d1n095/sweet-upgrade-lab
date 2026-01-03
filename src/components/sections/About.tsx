import { motion } from 'framer-motion';
import { Award, Users, Leaf, Clock } from 'lucide-react';

const About = () => {
  const stats = [
    { icon: Users, value: '10,000+', label: 'Nöjda kunder' },
    { icon: Award, value: '5 år', label: 'Garanti på allt' },
    { icon: Leaf, value: '100%', label: 'Grön energi' },
    { icon: Clock, value: '24/7', label: 'Support' },
  ];

  return (
    <section id="about" className="py-20 md:py-32 bg-card">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Content */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="order-2 lg:order-1"
          >
            <h2 className="font-display text-3xl md:text-5xl font-bold mb-6">
              Varför välja{' '}
              <span className="text-gradient">ChargerShop?</span>
            </h2>
            <p className="text-muted-foreground text-lg mb-8 leading-relaxed">
              Vi har sedan 2018 varit Sveriges ledande leverantör av laddlösningar för elbilar. 
              Med fokus på kvalitet, innovation och kundservice hjälper vi dig att göra övergången 
              till eldrift så smidig som möjligt.
            </p>
            <p className="text-muted-foreground text-lg mb-8 leading-relaxed">
              Vårt team av experter finns tillgängliga för att guida dig genom hela processen - 
              från val av rätt produkt till professionell installation och ongoing support.
            </p>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              {stats.map((stat, index) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="p-4 rounded-xl bg-secondary/50"
                >
                  <stat.icon className="w-6 h-6 text-primary mb-2" />
                  <div className="font-display text-2xl font-bold">{stat.value}</div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Visual */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="order-1 lg:order-2 relative"
          >
            <div className="relative aspect-square max-w-md mx-auto">
              {/* Decorative elements */}
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/20 to-transparent" />
              <div className="absolute -top-4 -right-4 w-32 h-32 bg-primary/20 rounded-full blur-2xl" />
              <div className="absolute -bottom-4 -left-4 w-40 h-40 bg-primary/10 rounded-full blur-2xl" />
              
              {/* Main image placeholder */}
              <div className="relative z-10 w-full h-full rounded-3xl bg-secondary border border-border overflow-hidden flex items-center justify-center">
                <div className="text-center p-8">
                  <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-primary/20 flex items-center justify-center">
                    <Award className="w-12 h-12 text-primary" />
                  </div>
                  <h3 className="font-display text-xl font-bold mb-2">Kvalitet i fokus</h3>
                  <p className="text-muted-foreground text-sm">
                    Alla våra produkter är noggrant utvalda och testade
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default About;
