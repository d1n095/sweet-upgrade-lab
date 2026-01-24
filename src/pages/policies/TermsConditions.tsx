import { motion } from 'framer-motion';
import { FileText } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import SEOHead from '@/components/seo/SEOHead';
import { storeConfig } from '@/config/storeConfig';

const TermsConditions = () => {
  const { language } = useLanguage();

  const content = {
    sv: {
      title: 'Allmänna Villkor',
      badge: 'Villkor',
      sections: [
        {
          title: 'Allmänt',
          text: `Dessa allmänna villkor gäller för alla köp som görs via vår webbplats. Genom att genomföra ett köp godkänner du dessa villkor i sin helhet. Vi förbehåller oss rätten att uppdatera villkoren utan föregående meddelande. Det är kundens ansvar att hålla sig informerad om gällande villkor.`
        },
        {
          title: 'Företagsinformation',
          text: `4ThePeople är en europeisk e-handelsverksamhet med säte i EU. Vi agerar som förmedlare mellan våra leverantörer och dig som kund. Produkterna levereras direkt från våra noggrant utvalda samarbetspartners inom EU.`
        },
        {
          title: 'Priser och betalning',
          text: `Alla priser anges i SEK inklusive moms (25%). Vi reserverar oss för eventuella prisändringar, tryckfel och slutförsäljning. Betalning sker via säkra betalningslösningar (kort, Klarna, Swish). Din order behandlas först när betalningen är bekräftad och godkänd.`
        },
        {
          title: 'Orderbekräftelse',
          text: `Efter genomfört köp skickas en orderbekräftelse till din e-postadress. Denna bekräftelse utgör ditt kvitto. Spara den för eventuella reklamationer eller returer. Om du inte mottar bekräftelse inom 24 timmar, kontakta vår kundtjänst.`
        },
        {
          title: 'Leverans och orderhantering',
          text: `Vi samarbetar med leverantörer som skickar produkterna direkt till dig. Leveranstiden är normalt ${storeConfig.shipping.deliveryTime.sv}. Förseningar kan förekomma vid högsäsong eller på grund av omständigheter utanför vår kontroll. Du får spårningsinformation via e-post när din order har skickats.`
        },
        {
          title: 'Ångerrätt',
          text: `Enligt distansavtalslagen har du ${storeConfig.returns.period} dagars ångerrätt från den dag du tar emot varan. Produkten ska vara oanvänd och i originalförpackning. Kontakta oss på ${storeConfig.contact.email} för att påbörja en retur.`
        },
        {
          title: 'Reklamation',
          text: `Om en produkt är defekt eller skadad vid leverans har du rätt att reklamera. Kontakta oss inom skälig tid efter att felet upptäckts. Vi följer konsumentköplagen och du har alltid minst 3 års reklamationsrätt på fabriksfel.`
        },
        {
          title: 'Force Majeure',
          text: `Vi ansvarar inte för förseningar orsakade av omständigheter utanför vår kontroll, såsom naturkatastrofer, pandemi, krig, strejk, eller leveransproblem hos våra partners.`
        },
        {
          title: 'Tvistelösning',
          text: `Vid eventuell tvist följer vi svensk lagstiftning. Du kan även vända dig till Allmänna Reklamationsnämnden (ARN) för en opartisk prövning.`
        }
      ]
    },
    en: {
      title: 'Terms & Conditions',
      badge: 'Terms',
      sections: [
        {
          title: 'General',
          text: `These general terms apply to all purchases made through our website. By completing a purchase, you agree to these terms in full. We reserve the right to update the terms without prior notice. It is the customer's responsibility to stay informed about current terms.`
        },
        {
          title: 'Company Information',
          text: `4ThePeople is a European e-commerce business based in the EU. We act as an intermediary between our suppliers and you as a customer. Products are delivered directly from our carefully selected partners within the EU.`
        },
        {
          title: 'Prices and Payment',
          text: `All prices are in SEK including VAT (25%). We reserve the right for price changes, printing errors and sold-out items. Payment is made through secure payment solutions (card, Klarna, Swish). Your order is processed only when payment is confirmed and approved.`
        },
        {
          title: 'Order Confirmation',
          text: `After completing your purchase, an order confirmation is sent to your email address. This confirmation serves as your receipt. Save it for any claims or returns. If you don't receive confirmation within 24 hours, contact our customer service.`
        },
        {
          title: 'Delivery and Order Handling',
          text: `We work with suppliers who ship products directly to you. Delivery time is normally ${storeConfig.shipping.deliveryTime.en}. Delays may occur during peak season or due to circumstances beyond our control. You will receive tracking information via email when your order has been shipped.`
        },
        {
          title: 'Right of Withdrawal',
          text: `According to the Distance Selling Act, you have ${storeConfig.returns.period} days right of withdrawal from the day you receive the product. The product must be unused and in original packaging. Contact us at ${storeConfig.contact.email} to initiate a return.`
        },
        {
          title: 'Complaints',
          text: `If a product is defective or damaged upon delivery, you have the right to file a complaint. Contact us within a reasonable time after discovering the defect. We follow consumer protection laws and you always have at least 3 years warranty on manufacturing defects.`
        },
        {
          title: 'Force Majeure',
          text: `We are not responsible for delays caused by circumstances beyond our control, such as natural disasters, pandemic, war, strikes, or delivery problems with our partners.`
        },
        {
          title: 'Dispute Resolution',
          text: `In case of a dispute, we follow Swedish law. You can also contact the National Board for Consumer Disputes (ARN) for an impartial review.`
        }
      ]
    }
  };

  const t = content[language as keyof typeof content] || content.en;

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={t.title}
        description={language === 'sv' 
          ? 'Läs våra allmänna villkor för köp, priser och betalning.'
          : 'Read our terms and conditions for purchases, prices and payment.'}
        canonical="/policies/terms"
      />
      <Header />
      <main className="pt-24 pb-20">
        <div className="container mx-auto px-4 max-w-3xl">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <FileText className="w-4 h-4" />
              {t.badge}
            </span>
            <h1 className="font-display text-4xl md:text-5xl font-semibold mb-8">
              {t.title}
            </h1>
            
            <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
              {t.sections.map((section, index) => (
                <motion.div 
                  key={section.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <h2 className="font-display text-xl font-semibold text-foreground mb-3">
                    {section.title}
                  </h2>
                  <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                    {section.text}
                  </p>
                </motion.div>
              ))}
              
              <div className="mt-12 p-6 bg-secondary/50 rounded-2xl">
                <p className="text-sm text-muted-foreground">
                  {language === 'sv' 
                    ? `Senast uppdaterad: Januari 2026. Vid frågor kontakta oss på ${storeConfig.contact.email}`
                    : `Last updated: January 2026. For questions contact us at ${storeConfig.contact.email}`}
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default TermsConditions;