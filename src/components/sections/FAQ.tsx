import { motion } from 'framer-motion';
import { useLanguage } from '@/context/LanguageContext';
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
  const { language, t } = useLanguage();

  return (
    <section id="faq" className="py-20 md:py-32 bg-secondary/20">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="font-display text-3xl md:text-5xl font-bold mb-4">
            {language === 'sv' ? 'Vanliga' : 'Frequently Asked'}{' '}
            <span className="text-gradient">{language === 'sv' ? 'Frågor' : 'Questions'}</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {language === 'sv' 
              ? 'Här hittar du svar på de vanligaste frågorna om våra produkter och tjänster'
              : 'Here you\'ll find answers to the most common questions about our products and services'
            }
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="max-w-3xl mx-auto"
        >
          <Accordion type="single" collapsible className="space-y-4">
            {faqData.map((faq, index) => (
              <AccordionItem 
                key={index} 
                value={`item-${index}`}
                className="glass-card px-6 border-none"
              >
                <AccordionTrigger className="text-left font-semibold hover:text-primary transition-colors">
                  {faq.question[language]}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
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
