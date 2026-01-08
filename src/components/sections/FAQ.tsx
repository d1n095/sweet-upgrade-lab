import { motion } from 'framer-motion';
import { useLanguage } from '@/context/LanguageContext';
import { HelpCircle } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const faqData = [
  {
    question: { sv: 'Hur lång är leveranstiden?', en: 'What is the delivery time?' },
    answer: { sv: 'Leveranstiden är vanligtvis 7-14 arbetsdagar beroende på produkt och destination. Vi skickar ett spårningsnummer så fort din beställning har skickats.', en: 'Delivery time is usually 7-14 business days depending on product and destination. We\'ll send a tracking number as soon as your order has been shipped.' }
  },
  {
    question: { sv: 'Kan jag returnera produkter?', en: 'Can I return products?' },
    answer: { sv: 'Ja, du har 14 dagars ångerrätt enligt konsumentköplagen. Produkten måste vara oanvänd och i originalförpackning. Kontakta oss för returinstruktioner.', en: 'Yes, you have 14 days right of withdrawal according to consumer law. The product must be unused and in original packaging. Contact us for return instructions.' }
  },
  {
    question: { sv: 'Är produkterna verkligen giftfria?', en: 'Are the products really toxin-free?' },
    answer: { sv: 'Absolut! Vi väljer noggrant ut alla våra produkter och säkerställer att de är fria från skadliga kemikalier, parabener, sulfater och andra oönskade ämnen.', en: 'Absolutely! We carefully select all our products and ensure they are free from harmful chemicals, parabens, sulfates and other unwanted substances.' }
  },
  {
    question: { sv: 'Vilka betalningsalternativ finns?', en: 'What payment options are available?' },
    answer: { sv: 'Vi accepterar alla vanliga betalmetoder inklusive kort (Visa, Mastercard), Klarna, Swish och banköverföring. Alla transaktioner är krypterade och säkra.', en: 'We accept all common payment methods including cards (Visa, Mastercard), Klarna, Swish and bank transfer. All transactions are encrypted and secure.' }
  },
  {
    question: { sv: 'Hur kontaktar jag kundtjänst?', en: 'How do I contact customer service?' },
    answer: { sv: 'Du kan nå oss via e-post på hej@4thepeople.se eller telefon 070-123 45 67. Vi svarar vanligtvis inom 24 timmar på vardagar.', en: 'You can reach us via email at hej@4thepeople.se or phone 070-123 45 67. We usually respond within 24 hours on weekdays.' }
  },
  {
    question: { sv: 'Skickar ni internationellt?', en: 'Do you ship internationally?' },
    answer: { sv: 'Ja, vi skickar till de flesta länder i Europa. Fraktkostnaden beräknas i kassan baserat på destination och vikt. Kontakta oss för frågor om specifika länder.', en: 'Yes, we ship to most countries in Europe. Shipping cost is calculated at checkout based on destination and weight. Contact us for questions about specific countries.' }
  }
];

const FAQ = () => {
  const { language } = useLanguage();

  return (
    <section id="faq" className="section-padding bg-secondary/30 relative overflow-hidden">
      {/* Decorative elements */}
      <div className="decorative-circle w-[400px] h-[400px] bg-primary/5 top-20 -left-32" />
      <div className="decorative-circle w-[300px] h-[300px] bg-accent/5 bottom-20 -right-20" />
      
      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-6">
            <HelpCircle className="w-7 h-7 text-primary" />
          </div>
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-semibold mb-5">
            {language === 'sv' ? 'Vanliga ' : 'Frequently Asked '}
            <span className="text-gradient">{language === 'sv' ? 'Frågor' : 'Questions'}</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {language === 'sv' 
              ? 'Här hittar du svar på de vanligaste frågorna om våra produkter och tjänster.'
              : 'Here you\'ll find answers to the most common questions about our products and services.'
            }
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="max-w-3xl mx-auto"
        >
          <Accordion type="single" collapsible className="space-y-4">
            {faqData.map((faq, index) => (
              <AccordionItem 
                key={index} 
                value={`item-${index}`}
                className="card-soft px-6 md:px-8 border-none overflow-hidden"
              >
                <AccordionTrigger className="text-left font-display font-semibold text-base md:text-lg hover:text-primary transition-colors py-5 [&[data-state=open]]:text-primary">
                  {faq.question[language]}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-5 leading-relaxed">
                  {faq.answer[language]}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
};

export default FAQ;