import { motion } from 'framer-motion';
import { useLanguage, getContentLang } from '@/context/LanguageContext';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const faqData = [
  {
    question: { sv: 'Hur lång är leveranstiden?', en: 'What is the delivery time?' },
    answer: { sv: 'Leveranstiden är vanligtvis 5-10 arbetsdagar. Vi skickar från EU-lager och du får ett spårningsnummer så fort din beställning har skickats.', en: 'Delivery time is usually 5-10 business days. We ship from EU warehouses and you\'ll receive a tracking number as soon as your order has been shipped.' }
  },
  {
    question: { sv: 'Kan jag returnera produkter?', en: 'Can I return products?' },
    answer: { sv: 'Ja, du har 30 dagars öppet köp. Produkten måste vara oanvänd och i originalförpackning. Kontakta oss för returinstruktioner.', en: 'Yes, you have 30 days to return. The product must be unused and in original packaging. Contact us for return instructions.' }
  },
  {
    question: { sv: 'Är produkterna verkligen giftfria?', en: 'Are the products really toxin-free?' },
    answer: { sv: 'Vi väljer noggrant ut alla våra produkter och säkerställer att de är fria från skadliga kemikalier. Vi granskar internationella certifieringar och globala recensioner noggrant.', en: 'We carefully select all our products and ensure they are free from harmful chemicals. We thoroughly review international certifications and global reviews.' }
  },
  {
    question: { sv: 'Vilka betalningsalternativ finns?', en: 'What payment options are available?' },
    answer: { sv: 'Vi accepterar kort (Visa, Mastercard), Klarna, Swish och banköverföring. Alla transaktioner är krypterade och säkra.', en: 'We accept cards (Visa, Mastercard), Klarna, Swish and bank transfer. All transactions are encrypted and secure.' }
  },
  {
    question: { sv: 'Hur kontaktar jag kundtjänst?', en: 'How do I contact customer service?' },
    answer: { sv: 'Du kan nå oss via e-post på hej@4thepeople.se. Vi svarar vanligtvis inom 24 timmar på vardagar.', en: 'You can reach us via email at hej@4thepeople.se. We usually respond within 24 hours on weekdays.' }
  },
  {
    question: { sv: 'Varför är leveranstiden längre än vanliga butiker?', en: 'Why is the delivery time longer than regular stores?' },
    answer: { sv: 'Vi samarbetar med pålitliga leverantörer i EU för att kunna erbjuda kvalitetsprodukter till bra priser. Genom att inte ha ett stort mellanlager kan vi hålla nere kostnaderna.', en: 'We work with reliable suppliers in the EU to offer quality products at good prices. By not maintaining a large warehouse, we keep costs down.' }
  }
];

const FAQ = () => {
  const { t, language } = useLanguage();
  const lang = getContentLang(language);

  return (
    <section id="faq" className="py-16 md:py-20 bg-secondary/20">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-8"
        >
          <h2 className="text-2xl md:text-3xl font-bold mb-2">
            {t('faq.title')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t('faq.subtitle')}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="max-w-2xl mx-auto"
        >
          <Accordion type="single" collapsible className="space-y-2">
            {faqData.map((faq, index) => (
              <AccordionItem 
                key={index} 
                value={`item-${index}`}
                className="bg-card border border-border rounded-xl px-5 overflow-hidden"
              >
                <AccordionTrigger className="text-left font-medium text-sm hover:text-accent transition-colors py-4 [&[data-state=open]]:text-accent">
                  {faq.question[lang] || faq.question.en}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground pb-4 leading-relaxed">
                  {faq.answer[lang] || faq.answer.en}
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
