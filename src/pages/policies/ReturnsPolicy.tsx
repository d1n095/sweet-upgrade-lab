import { motion } from 'framer-motion';
import { RotateCcw } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { storeConfig } from '@/config/storeConfig';

const ReturnsPolicy = () => {
  const { language } = useLanguage();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-24 pb-20">
        <div className="container mx-auto px-4 max-w-3xl">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <RotateCcw className="w-4 h-4" />
              {language === 'sv' ? 'Returer' : 'Returns'}
            </span>
            <h1 className="font-display text-4xl md:text-5xl font-semibold mb-8">
              {language === 'sv' ? 'Retur & Återbetalning' : 'Returns & Refunds'}
            </h1>
            
            <div className="prose prose-invert max-w-none space-y-6 text-muted-foreground">
              <h2 className="font-display text-xl font-semibold text-foreground">{language === 'sv' ? 'Ångerrätt' : 'Right of Withdrawal'}</h2>
              <p>{language === 'sv' ? `Du har ${storeConfig.returns.period} dagars ångerrätt från det att du mottagit din order. För att utnyttja ångerrätten behöver produkten vara oanvänd och i originalförpackning.` : `You have ${storeConfig.returns.period} days right of withdrawal from receiving your order. The product must be unused and in original packaging.`}</p>
              
              <h2 className="font-display text-xl font-semibold text-foreground">{language === 'sv' ? 'Så här returnerar du' : 'How to Return'}</h2>
              <p>{language === 'sv' ? `1. Kontakta oss på ${storeConfig.contact.email}\n2. Ange ordernummer och anledning\n3. Vi skickar returinstruktioner\n4. Återbetalning sker inom 14 dagar` : `1. Contact us at ${storeConfig.contact.email}\n2. Provide order number and reason\n3. We'll send return instructions\n4. Refund within 14 days`}</p>
              
              <h2 className="font-display text-xl font-semibold text-foreground">{language === 'sv' ? 'Undantag' : 'Exceptions'}</h2>
              <p>{language === 'sv' ? 'Hygienartiklar och öppnade förpackningar kan ej returneras av hälsoskäl.' : 'Hygiene products and opened packages cannot be returned for health reasons.'}</p>
            </div>
          </motion.div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ReturnsPolicy;
