import { motion } from 'framer-motion';
import { ShoppingCart, Package, Truck, CheckCircle, RotateCcw, Shield, Clock, CreditCard } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { storeConfig } from '@/config/storeConfig';
import { Button } from '@/components/ui/button';

const HowItWorks = () => {
  const { language } = useLanguage();

  const steps = [
    {
      number: '01',
      icon: ShoppingCart,
      title: { sv: 'Välj produkter', en: 'Choose products' },
      description: {
        sv: 'Bläddra i vårt sortiment av noggrant utvalda produkter och lägg de du vill ha i varukorgen.',
        en: 'Browse our carefully selected range of products and add the ones you want to your cart.',
      },
    },
    {
      number: '02',
      icon: CreditCard,
      title: { sv: 'Betala säkert', en: 'Pay securely' },
      description: {
        sv: 'Välj din föredragna betalningsmetod. Vi erbjuder Kort, Klarna, Swish och fler alternativ.',
        en: 'Choose your preferred payment method. We offer Card, Klarna, Swish and more options.',
      },
    },
    {
      number: '03',
      icon: Package,
      title: { sv: 'Vi behandlar din order', en: 'We process your order' },
      description: {
        sv: 'Vi granskar din beställning manuellt för att säkerställa kvalitet, sedan skickas den från våra EU-baserade leverantörer.',
        en: 'We manually review your order to ensure quality, then it\'s shipped from our EU-based suppliers.',
      },
    },
    {
      number: '04',
      icon: Truck,
      title: { sv: 'Leverans hem', en: 'Home delivery' },
      description: {
        sv: `Leverans tar normalt 7-10 arbetsdagar. Du får spårningsinformation via e-post när paketet skickats.`,
        en: `Delivery normally takes 7-10 business days. You'll receive tracking info via email when shipped.`,
      },
    },
    {
      number: '05',
      icon: CheckCircle,
      title: { sv: 'Njut!', en: 'Enjoy!' },
      description: {
        sv: 'Dina produkter är hemma och redo att användas. Inte nöjd? Du har 14 dagars ångerrätt.',
        en: 'Your products are home and ready to use. Not satisfied? You have 14 days to return.',
      },
    },
  ];

  const guarantees = [
    {
      icon: Shield,
      title: { sv: 'Säker betalning', en: 'Secure payment' },
      description: { 
        sv: 'Alla transaktioner är krypterade och säkra.',
        en: 'All transactions are encrypted and secure.'
      },
    },
    {
      icon: RotateCcw,
      title: { sv: `${storeConfig.returns.period} dagars ångerrätt`, en: `${storeConfig.returns.period} day return policy` },
      description: { 
        sv: 'Inte nöjd? Returnera inom 14 dagar.',
        en: 'Not satisfied? Return within 14 days.'
      },
    },
    {
      icon: Clock,
      title: { sv: 'Snabb leverans', en: 'Fast delivery' },
      description: { 
        sv: storeConfig.shipping.deliveryTime.sv,
        en: storeConfig.shipping.deliveryTime.en
      },
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-24 pb-20">
        {/* Hero */}
        <section className="container mx-auto px-4 mb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-3xl mx-auto"
          >
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <ShoppingCart className="w-4 h-4" />
              {language === 'sv' ? 'Så Funkar Det' : 'How It Works'}
            </span>
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-semibold mb-6">
              {language === 'sv' ? 'Enkelt att handla' : 'Easy shopping'}
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              {language === 'sv'
                ? 'Vi har gjort det så enkelt som möjligt att handla hållbara produkter. Följ stegen nedan för att komma igång.'
                : 'We\'ve made it as easy as possible to shop for sustainable products. Follow the steps below to get started.'}
            </p>
          </motion.div>
        </section>

        {/* Steps */}
        <section className="container mx-auto px-4 mb-20">
          <div className="max-w-3xl mx-auto">
            {steps.map((step, index) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="flex gap-6 mb-12 last:mb-0"
              >
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <step.icon className="w-7 h-7 text-primary" />
                  </div>
                  {index < steps.length - 1 && (
                    <div className="w-0.5 h-full bg-gradient-to-b from-primary/50 to-transparent mt-4" />
                  )}
                </div>
                <div className="flex-1 pt-2">
                  <span className="text-sm text-primary font-medium">
                    {language === 'sv' ? 'Steg' : 'Step'} {step.number}
                  </span>
                  <h3 className="font-display text-2xl font-semibold mt-1 mb-3">
                    {step.title[language]}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {step.description[language]}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Guarantees */}
        <section className="bg-card border-y border-border/50 py-16 mb-20">
          <div className="container mx-auto px-4">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="font-display text-3xl font-semibold text-center mb-12"
            >
              {language === 'sv' ? 'Våra Garantier' : 'Our Guarantees'}
            </motion.h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              {guarantees.map((guarantee, index) => (
                <motion.div
                  key={guarantee.title.sv}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="text-center"
                >
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <guarantee.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-display text-lg font-semibold mb-2">
                    {guarantee.title[language]}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    {guarantee.description[language]}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Shipping Info */}
        <section className="container mx-auto px-4 mb-20">
          <div className="max-w-2xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-gradient-to-br from-primary/10 to-accent/10 rounded-3xl p-8"
            >
              <h2 className="font-display text-2xl font-semibold mb-6 text-center">
                {language === 'sv' ? 'Fraktinformation' : 'Shipping Information'}
              </h2>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center py-3 border-b border-border/30">
                  <span className="text-muted-foreground">
                    {language === 'sv' ? 'Fraktkostnad' : 'Shipping cost'}
                  </span>
                  <span className="font-semibold">{storeConfig.shipping.cost} kr</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-border/30">
                  <span className="text-muted-foreground">
                    {language === 'sv' ? 'Fri frakt över' : 'Free shipping over'}
                  </span>
                  <span className="font-semibold text-primary">{storeConfig.shipping.freeShippingThreshold} kr</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-border/30">
                  <span className="text-muted-foreground">
                    {language === 'sv' ? 'Leveranstid' : 'Delivery time'}
                  </span>
                  <span className="font-semibold">{storeConfig.shipping.deliveryTime[language]}</span>
                </div>
                <div className="flex justify-between items-center py-3">
                  <span className="text-muted-foreground">
                    {language === 'sv' ? 'Ångerrätt' : 'Return policy'}
                  </span>
                  <span className="font-semibold">{storeConfig.returns.period} {language === 'sv' ? 'dagar' : 'days'}</span>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* CTA */}
        <section className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <h2 className="font-display text-2xl font-semibold mb-4">
              {language === 'sv' ? 'Redo att börja handla?' : 'Ready to start shopping?'}
            </h2>
            <Button size="lg" asChild>
              <a href="/shop">
                {language === 'sv' ? 'Utforska produkter' : 'Explore products'}
              </a>
            </Button>
          </motion.div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default HowItWorks;
